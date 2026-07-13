import uuid
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.decision import (
    Decision,
    DecisionEvent,
    DecisionEvidence,
)
from app.models.document import (
    Document,
    DocumentChunk,
)
from app.models.graph import (
    GraphEntity,
    GraphRelationship,
)
from app.schemas.context import (
    AggregatedContextResponse,
    AggregatedDecisionContext,
    AggregatedDecisionEvidence,
    AggregatedDocumentContext,
    AggregatedGraphRelationship,
    AggregatedTimelineEvent,
    ContextSourceCounts,
)
from app.services.decision_search_service import (
    DecisionMatch,
    find_relevant_decisions,
)
from app.services.query_classifier import (
    classify_decision_query,
)
from app.services.search_service import hybrid_search


@dataclass
class AggregatorLimits:
    decision_limit: int = 3
    document_limit: int = 8
    timeline_limit: int = 20
    graph_neighbor_limit: int = 25
    minimum_similarity: float = 0.0


def safe_list(value) -> list:
    if isinstance(value, list):
        return value

    if value is None:
        return []

    return [value]


def load_decision_evidence(
    database: Session,
    decision_id: uuid.UUID,
    limit: int = 10,
) -> list[AggregatedDecisionEvidence]:
    rows = database.execute(
        select(
            DecisionEvidence,
            DocumentChunk,
            Document,
        )
        .join(
            DocumentChunk,
            DocumentChunk.id
            == DecisionEvidence.chunk_id,
        )
        .join(
            Document,
            Document.id
            == DocumentChunk.document_id,
        )
        .where(
            DecisionEvidence.decision_id
            == decision_id
        )
        .order_by(
            DecisionEvidence.relevance_score.desc()
        )
        .limit(limit)
    ).all()

    evidence_items: list[
        AggregatedDecisionEvidence
    ] = []

    for evidence, chunk, document in rows:
        evidence_items.append(
            AggregatedDecisionEvidence(
                evidence_id=evidence.id,
                chunk_id=chunk.id,
                document_id=document.id,
                document_name=(
                    document.original_filename
                ),
                content=chunk.content,
                page_number=chunk.page_number,
                section_title=chunk.section_title,
                evidence_type=getattr(
                    evidence,
                    "evidence_type",
                    None,
                ),
                relevance_score=float(
                    getattr(
                        evidence,
                        "relevance_score",
                        0.0,
                    )
                    or 0.0
                ),
                explanation=getattr(
                    evidence,
                    "explanation",
                    None,
                ),
            )
        )

    return evidence_items


def load_decision_timeline(
    database: Session,
    decision_id: uuid.UUID,
    limit: int,
) -> list[AggregatedTimelineEvent]:
    events = list(
        database.scalars(
            select(DecisionEvent)
            .where(
                DecisionEvent.decision_id
                == decision_id
            )
            .order_by(
                DecisionEvent.event_date
                .asc()
                .nullslast(),
                DecisionEvent.created_at.asc(),
            )
            .limit(limit)
        )
    )

    return [
        AggregatedTimelineEvent(
            event_id=event.id,
            event_type=event.event_type,
            title=event.title,
            description=event.description,
            event_date=event.event_date,
            source_reference=(
                event.source_reference or {}
            ),
        )
        for event in events
    ]


def find_decision_graph_entity(
    database: Session,
    workspace_id: uuid.UUID,
    decision: Decision,
) -> GraphEntity | None:
    entity = database.scalar(
        select(GraphEntity).where(
            GraphEntity.workspace_id
            == workspace_id,
            GraphEntity.entity_type
            == "decision",
            GraphEntity.metadata_json[
                "decision_id"
            ].astext
            == str(decision.id),
        )
    )

    if entity is not None:
        return entity

    normalized_title = (
        " ".join(decision.title.lower().split())
    )

    return database.scalar(
        select(GraphEntity).where(
            GraphEntity.workspace_id
            == workspace_id,
            GraphEntity.entity_type
            == "decision",
            GraphEntity.normalized_name
            == normalized_title,
        )
    )


def load_graph_relationships(
    database: Session,
    workspace_id: uuid.UUID,
    decision: Decision,
    limit: int,
) -> list[AggregatedGraphRelationship]:
    decision_entity = find_decision_graph_entity(
        database=database,
        workspace_id=workspace_id,
        decision=decision,
    )

    if decision_entity is None:
        return []

    relationships = list(
        database.scalars(
            select(GraphRelationship)
            .where(
                GraphRelationship.workspace_id
                == workspace_id,
                or_(
                    GraphRelationship.source_entity_id
                    == decision_entity.id,
                    GraphRelationship.target_entity_id
                    == decision_entity.id,
                ),
            )
            .limit(limit)
        )
    )

    if not relationships:
        return []

    entity_ids: set[uuid.UUID] = set()

    for relationship in relationships:
        entity_ids.add(
            relationship.source_entity_id
        )
        entity_ids.add(
            relationship.target_entity_id
        )

    entities = list(
        database.scalars(
            select(GraphEntity).where(
                GraphEntity.id.in_(entity_ids)
            )
        )
    )

    entity_map = {
        entity.id: entity
        for entity in entities
    }

    result: list[
        AggregatedGraphRelationship
    ] = []

    for relationship in relationships:
        source = entity_map.get(
            relationship.source_entity_id
        )
        target = entity_map.get(
            relationship.target_entity_id
        )

        if source is None or target is None:
            continue

        result.append(
            AggregatedGraphRelationship(
                relationship_id=relationship.id,
                source_entity_id=source.id,
                source_name=source.name,
                source_type=source.entity_type,
                relationship_type=(
                    relationship.relationship_type
                ),
                target_entity_id=target.id,
                target_name=target.name,
                target_type=target.entity_type,
                description=(
                    relationship.description
                ),
            )
        )

    return result


def aggregate_decision(
    database: Session,
    workspace_id: uuid.UUID,
    match: DecisionMatch,
    limits: AggregatorLimits,
) -> AggregatedDecisionContext:
    decision = match.decision

    evidence = load_decision_evidence(
        database=database,
        decision_id=decision.id,
    )

    timeline = load_decision_timeline(
        database=database,
        decision_id=decision.id,
        limit=limits.timeline_limit,
    )

    graph_relationships = (
        load_graph_relationships(
            database=database,
            workspace_id=workspace_id,
            decision=decision,
            limit=limits.graph_neighbor_limit,
        )
    )

    return AggregatedDecisionContext(
        decision_id=decision.id,
        title=decision.title,
        summary=decision.summary,
        decision_statement=(
            decision.decision_statement
        ),
        reason=decision.reason,
        alternatives=safe_list(
            decision.alternatives
        ),
        participants=safe_list(
            decision.participants
        ),
        related_entities=safe_list(
            decision.related_entities
        ),
        status=decision.status,
        confidence_score=float(
            decision.confidence_score or 0.0
        ),
        decision_date=decision.decision_date,
        relevance_score=match.relevance_score,
        evidence=evidence,
        timeline=timeline,
        graph_relationships=(
            graph_relationships
        ),
    )


def aggregate_document_results(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limits: AggregatorLimits,
) -> list[AggregatedDocumentContext]:
    results, _, _ = hybrid_search(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limit=limits.document_limit,
        semantic_limit=max(
            limits.document_limit * 3,
            15,
        ),
        keyword_limit=max(
            limits.document_limit * 3,
            15,
        ),
        minimum_similarity=(
            limits.minimum_similarity
        ),
        rrf_k=60,
    )

    return [
        AggregatedDocumentContext(
            chunk_id=result.chunk_id,
            document_id=result.document_id,
            document_name=result.document_name,
            source_type=result.source_type,
            chunk_index=result.chunk_index,
            content=result.content,
            page_number=result.page_number,
            section_title=result.section_title,
            semantic_rank=result.semantic_rank,
            semantic_similarity=(
                result.semantic_similarity
            ),
            keyword_rank=result.keyword_rank,
            keyword_score=result.keyword_score,
            exact_match=result.exact_match,
            fused_score=result.fused_score,
            matched_by=result.matched_by,
        )
        for result in results
    ]


def aggregate_context(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limits: AggregatorLimits | None = None,
) -> AggregatedContextResponse:
    resolved_limits = (
        limits or AggregatorLimits()
    )

    classification = (
        classify_decision_query(query)
    )

    decision_matches = (
        find_relevant_decisions(
            database=database,
            workspace_id=workspace_id,
            query=query,
            limit=resolved_limits.decision_limit,
        )
    )

    decisions = [
        aggregate_decision(
            database=database,
            workspace_id=workspace_id,
            match=match,
            limits=resolved_limits,
        )
        for match in decision_matches
    ]

    documents = aggregate_document_results(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limits=resolved_limits,
    )

    evidence_count = sum(
        len(decision.evidence)
        for decision in decisions
    )

    timeline_count = sum(
        len(decision.timeline)
        for decision in decisions
    )

    relationship_count = sum(
        len(decision.graph_relationships)
        for decision in decisions
    )

    source_counts = ContextSourceCounts(
        decisions=len(decisions),
        decision_evidence=evidence_count,
        timeline_events=timeline_count,
        graph_relationships=relationship_count,
        document_chunks=len(documents),
    )

    return AggregatedContextResponse(
        query=query,
        query_type=classification.query_type,
        classification_confidence=(
            classification.confidence
        ),
        matched_terms=(
            classification.matched_terms
        ),
        decisions=decisions,
        documents=documents,
        source_counts=source_counts,
        evidence_found=bool(
            decisions or documents
        ),
    )
