import uuid

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.context import (
    DecisionReasoningResponse,
    ReasoningCitation,
)
from app.services.context_aggregator import (
    AggregatorLimits,
    aggregate_context,
)
from app.services.context_ranker import (
    RankingOptions,
    rank_context,
)
from app.services.claim_citation_service import (
    build_claim_citation_groups,
)
from app.services.decision_reasoning_service import (
    reason_over_context,
)


settings = get_settings()


def build_reasoning_citations(
    ranked_items,
    used_source_ids: list[str],
) -> list[ReasoningCitation]:
    item_map = {
        item.source_id: item
        for item in ranked_items
    }

    citations: list[ReasoningCitation] = []

    for citation_number, source_id in enumerate(
        used_source_ids,
        start=1,
    ):
        item = item_map.get(source_id)

        if item is None:
            continue

        metadata = item.metadata

        excerpt = item.content[:600]

        if len(item.content) > 600:
            excerpt += "..."

        citations.append(
            ReasoningCitation(
                citation_number=(
                    citation_number
                ),
                source_id=item.source_id,
                source_type=item.source_type,
                title=item.title,
                document_id=item.document_id,
                chunk_id=item.chunk_id,
                decision_id=item.decision_id,
                document_name=metadata.get(
                    "document_name"
                ),
                page_number=metadata.get(
                    "page_number"
                ),
                section_title=metadata.get(
                    "section_title"
                ),
                excerpt=excerpt,
                score=item.score,
            )
        )

    return citations


def generate_decision_intelligence(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    decision_limit: int,
    document_limit: int,
    timeline_limit: int,
    graph_neighbor_limit: int,
    minimum_similarity: float,
    token_budget: int,
    maximum_items: int,
    deduplication_threshold: float,
    include_raw_context: bool,
) -> DecisionReasoningResponse:
    aggregated_context = aggregate_context(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limits=AggregatorLimits(
            decision_limit=decision_limit,
            document_limit=document_limit,
            timeline_limit=timeline_limit,
            graph_neighbor_limit=(
                graph_neighbor_limit
            ),
            minimum_similarity=(
                minimum_similarity
            ),
        ),
    )

    ranked_context = rank_context(
        context=aggregated_context,
        options=RankingOptions(
            token_budget=token_budget,
            maximum_items=maximum_items,
            deduplication_threshold=(
                deduplication_threshold
            ),
        ),
    )

    reasoning_result = reason_over_context(
        query=query,
        query_type=(
            ranked_context.query_type
        ),
        ranked_items=(
            ranked_context.ranked_items
        ),
    )

    citations = build_reasoning_citations(
        ranked_items=(
            ranked_context.ranked_items
        ),
        used_source_ids=(
            reasoning_result.source_ids
        ),
    )

    (
        claim_citations,
        citation_coverage,
    ) = build_claim_citation_groups(
        result=reasoning_result,
        ranked_items=(
            ranked_context.ranked_items
        ),
    )

    return DecisionReasoningResponse(
        query=query,
        query_type=(
            ranked_context.query_type
        ),
        result=reasoning_result,
        citations=citations,
        claim_citations=claim_citations,
        citation_coverage=citation_coverage,
        selected_context_items=(
            ranked_context.selected_items
        ),
        estimated_context_tokens=(
            ranked_context.estimated_tokens
        ),
        model=settings.ollama_chat_model,
        raw_context=(
            ranked_context.ranked_items
            if include_raw_context
            else None
        ),
    )
