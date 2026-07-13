import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.decision import Decision, DecisionEvidence
from app.models.document import Document, DocumentChunk
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.decision import (
    DecisionDetailResponse,
    DecisionEvidenceResponse,
    DecisionExtractionResponse,
    DecisionResponse,
    DecisionReviewRequest,
    DecisionStatsResponse,
    DecisionUpdateRequest,
)
from app.tasks.decision_tasks import extract_document_decisions


router = APIRouter(
    prefix="/workspaces/{workspace_id}",
    tags=["Decisions"],
)


def get_decision_or_404(
    database: Session,
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> Decision:
    decision = database.scalar(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.workspace_id == workspace_id,
        )
    )

    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found",
        )

    return decision


@router.post(
    "/documents/{document_id}/extract-decisions",
    response_model=DecisionExtractionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def extract_decisions(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionExtractionResponse:
    if membership.role not in {
        "owner",
        "admin",
        "member",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to extract decisions",
        )

    document = database.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Document processing must complete before "
                "decision extraction"
            ),
        )

    task = extract_document_decisions.delay(
        str(document.id)
    )

    document.metadata_json = {
        **document.metadata_json,
        "decision_extraction_status": "queued",
        "decision_extraction_task_id": task.id,
    }

    database.commit()

    return DecisionExtractionResponse(
        document_id=document.id,
        status="queued",
        task_id=task.id,
    )


@router.get(
    "/decisions",
    response_model=list[DecisionResponse],
)
def list_decisions(
    workspace_id: uuid.UUID,
    decision_status: str | None = None,
    minimum_confidence: float = 0.0,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> list[Decision]:
    del membership

    statement = (
        select(Decision)
        .where(
            Decision.workspace_id == workspace_id,
            Decision.confidence_score >= minimum_confidence,
        )
        .order_by(
            Decision.decision_date.desc().nullslast(),
            Decision.created_at.desc(),
        )
    )

    if decision_status:
        statement = statement.where(
            Decision.status == decision_status
        )

    return list(database.scalars(statement))


@router.get(
    "/decisions/stats",
    response_model=DecisionStatsResponse,
)
def get_decision_stats(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionStatsResponse:
    del membership

    rows = database.execute(
        select(
            func.count(Decision.id),
            func.count(Decision.id).filter(
                Decision.status == "candidate"
            ),
            func.count(Decision.id).filter(
                Decision.status == "approved"
            ),
            func.count(Decision.id).filter(
                Decision.status == "rejected"
            ),
            func.coalesce(
                func.avg(Decision.confidence_score),
                0.0,
            ),
        ).where(
            Decision.workspace_id == workspace_id
        )
    ).one()

    return DecisionStatsResponse(
        total=rows[0],
        candidates=rows[1],
        approved=rows[2],
        rejected=rows[3],
        average_confidence=round(
            float(rows[4]),
            4,
        ),
    )


@router.get(
    "/decisions/{decision_id}",
    response_model=DecisionDetailResponse,
)
def get_decision(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionDetailResponse:
    del membership

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    evidence_rows = database.execute(
        select(
            DecisionEvidence,
            DocumentChunk,
            Document,
        )
        .join(
            DocumentChunk,
            DocumentChunk.id == DecisionEvidence.chunk_id,
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            DecisionEvidence.decision_id == decision.id
        )
        .order_by(
            DecisionEvidence.relevance_score.desc()
        )
    ).all()

    evidence = [
        DecisionEvidenceResponse(
            id=evidence_record.id,
            chunk_id=chunk.id,
            evidence_type=evidence_record.evidence_type,
            relevance_score=evidence_record.relevance_score,
            explanation=evidence_record.explanation,
            document_id=document.id,
            document_name=document.original_filename,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            page_number=chunk.page_number,
            section_title=chunk.section_title,
        )
        for evidence_record, chunk, document in evidence_rows
    ]

    base = DecisionResponse.model_validate(decision)

    return DecisionDetailResponse(
        **base.model_dump(),
        evidence=evidence,
    )


@router.patch(
    "/decisions/{decision_id}",
    response_model=DecisionResponse,
)
def update_decision(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    update_data: DecisionUpdateRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> Decision:
    if membership.role not in {
        "owner",
        "admin",
        "member",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit decisions",
        )

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    updates = update_data.model_dump(
        exclude_unset=True
    )

    for field_name, value in updates.items():
        setattr(decision, field_name, value)

    database.commit()
    database.refresh(decision)

    return decision


@router.patch(
    "/decisions/{decision_id}/review",
    response_model=DecisionResponse,
)
def review_decision(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    review_data: DecisionReviewRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Decision:
    if membership.role not in {
        "owner",
        "admin",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can review decisions",
        )

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    decision.status = review_data.status

    decision.reviewed_by = (
        current_user.id
        if review_data.status in {
            "approved",
            "rejected",
        }
        else None
    )

    database.commit()
    database.refresh(decision)

    return decision


@router.delete(
    "/decisions/{decision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_decision(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> None:
    if membership.role not in {
        "owner",
        "admin",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can delete decisions",
        )

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    database.delete(decision)
    database.commit()
