import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.workspace import WorkspaceMember
from app.schemas.context import (
    AggregatedContextResponse,
    ContextQueryRequest,
    ContextRankingRequest,
    DecisionReasoningRequest,
    DecisionReasoningResponse,
    RankedContextResponse,
)
from app.services.context_aggregator import (
    AggregatorLimits,
    aggregate_context,
)
from app.services.context_ranker import (
    RankingOptions,
    rank_context,
)
from app.services.decision_intelligence_service import (
    generate_decision_intelligence,
)
from app.services.decision_reasoning_service import (
    DecisionReasoningError,
)


router = APIRouter(
    prefix="/workspaces/{workspace_id}/context",
    tags=["Context Aggregation"],
)


def build_aggregator_limits(
    payload: ContextQueryRequest,
) -> AggregatorLimits:
    return AggregatorLimits(
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

    return aggregate_context(
        database=database,
        workspace_id=workspace_id,
        query=payload.query,
        limits=build_aggregator_limits(
            payload
        ),
    )


@router.post(
    "/rank",
    response_model=RankedContextResponse,
)
def rank_workspace_context(
    workspace_id: uuid.UUID,
    payload: ContextRankingRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> RankedContextResponse:
    del membership

    aggregated_context = aggregate_context(
        database=database,
        workspace_id=workspace_id,
        query=payload.query,
        limits=build_aggregator_limits(
            payload
        ),
    )

    return rank_context(
        context=aggregated_context,
        options=RankingOptions(
            token_budget=payload.token_budget,
            maximum_items=(
                payload.maximum_items
            ),
            deduplication_threshold=(
                payload
                .deduplication_threshold
            ),
        ),
    )


@router.post(
    "/reason",
    response_model=DecisionReasoningResponse,
)
def reason_over_workspace_context(
    workspace_id: uuid.UUID,
    payload: DecisionReasoningRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DecisionReasoningResponse:
    del membership

    try:
        return generate_decision_intelligence(
            database=database,
            workspace_id=workspace_id,
            query=payload.query,
            decision_limit=(
                payload.decision_limit
            ),
            document_limit=(
                payload.document_limit
            ),
            timeline_limit=(
                payload.timeline_limit
            ),
            graph_neighbor_limit=(
                payload.graph_neighbor_limit
            ),
            minimum_similarity=(
                payload.minimum_similarity
            ),
            token_budget=payload.token_budget,
            maximum_items=(
                payload.maximum_items
            ),
            deduplication_threshold=(
                payload
                .deduplication_threshold
            ),
            include_raw_context=(
                payload.include_raw_context
            ),
        )

    except DecisionReasoningError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error
