import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_workspace_membership
from app.db.dependencies import get_db
from app.models.decision import Decision, DecisionEvent
from app.models.workspace import WorkspaceMember
from app.schemas.timeline import (
    DecisionEventResponse,
    DecisionEventUpdateRequest,
    DecisionTimelineResponse,
    TimelineGenerationResponse,
)
from app.tasks.timeline_tasks import generate_decision_timeline


router = APIRouter(
    prefix="/workspaces/{workspace_id}/decisions/{decision_id}",
    tags=["Timelines"],
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


def get_event_or_404(
    database: Session,
    decision_id: uuid.UUID,
    event_id: uuid.UUID,
) -> DecisionEvent:
    event = database.scalar(
        select(DecisionEvent).where(
            DecisionEvent.id == event_id,
            DecisionEvent.decision_id == decision_id,
        )
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timeline event not found",
        )

    return event


@router.post(
    "/generate-timeline",
    response_model=TimelineGenerationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_timeline(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> TimelineGenerationResponse:
    if membership.role not in {
        "owner",
        "admin",
        "member",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to generate timelines",
        )

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    task = generate_decision_timeline.delay(
        str(decision.id)
    )

    return TimelineGenerationResponse(
        decision_id=decision.id,
        status="queued",
        task_id=task.id,
    )


@router.get(
    "/timeline",
    response_model=DecisionTimelineResponse,
)
def get_timeline(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionTimelineResponse:
    del membership

    decision = get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    events = list(
        database.scalars(
            select(DecisionEvent)
            .where(
                DecisionEvent.decision_id == decision.id
            )
            .order_by(
                DecisionEvent.event_date.asc().nullslast(),
                DecisionEvent.created_at.asc(),
            )
        )
    )

    return DecisionTimelineResponse(
        decision_id=decision.id,
        decision_title=decision.title,
        event_count=len(events),
        events=[
            DecisionEventResponse.model_validate(event)
            for event in events
        ],
    )


@router.patch(
    "/timeline/{event_id}",
    response_model=DecisionEventResponse,
)
def update_timeline_event(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    event_id: uuid.UUID,
    update_data: DecisionEventUpdateRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionEvent:
    if membership.role not in {
        "owner",
        "admin",
        "member",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit timeline events",
        )

    get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    event = get_event_or_404(
        database,
        decision_id,
        event_id,
    )

    updates = update_data.model_dump(
        exclude_unset=True
    )

    for field_name, value in updates.items():
        setattr(event, field_name, value)

    database.commit()
    database.refresh(event)

    return event


@router.delete(
    "/timeline/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_timeline_event(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    event_id: uuid.UUID,
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
            detail="Only owners and admins can delete timeline events",
        )

    get_decision_or_404(
        database,
        workspace_id,
        decision_id,
    )

    event = get_event_or_404(
        database,
        decision_id,
        event_id,
    )

    database.delete(event)
    database.commit()
