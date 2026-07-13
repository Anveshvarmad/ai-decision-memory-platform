import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.workspace import WorkspaceMember
from app.schemas.context import (
    AggregatedContextResponse,
    ContextQueryRequest,
)
from app.services.context_aggregator import (
    AggregatorLimits,
    aggregate_context,
)


router = APIRouter(
    prefix="/workspaces/{workspace_id}/context",
    tags=["Context Aggregation"],
)


@router.post(
    "/aggregate",
    response_model=AggregatedContextResponse,
)
def aggregate_workspace_context(
    workspace_id: uuid.UUID,
    payload: ContextQueryRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> AggregatedContextResponse:
    del membership

    limits = AggregatorLimits(
        decision_limit=payload.decision_limit,
        document_limit=payload.document_limit,
        timeline_limit=payload.timeline_limit,
        graph_neighbor_limit=(
            payload.graph_neighbor_limit
        ),
        minimum_similarity=(
            payload.minimum_similarity
        ),
    )

    return aggregate_context(
        database=database,
        workspace_id=workspace_id,
        query=payload.query,
        limits=limits,
    )
