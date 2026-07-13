import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.workspace import WorkspaceMember
from app.schemas.comparison import (
    DecisionComparisonRequest,
    DecisionComparisonResponse,
)
from app.services.decision_comparison_service import (
    DecisionComparisonError,
    compare_decisions,
)


router = APIRouter(
    prefix=(
        "/workspaces/{workspace_id}/"
        "decision-comparison"
    ),
    tags=["Decision Comparison"],
)


@router.post(
    "",
    response_model=DecisionComparisonResponse,
)
def compare_workspace_decisions(
    workspace_id: uuid.UUID,
    payload: DecisionComparisonRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionComparisonResponse:
    del membership

    try:
        return compare_decisions(
            database=database,
            workspace_id=workspace_id,
            decision_a_id=(
                payload.decision_a_id
            ),
            decision_b_id=(
                payload.decision_b_id
            ),
            question=payload.question,
            evidence_limit=(
                payload.evidence_limit
            ),
            timeline_limit=(
                payload.timeline_limit
            ),
        )
    except DecisionComparisonError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
