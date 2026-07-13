import uuid
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.decision import (
    DecisionEvent,
    DecisionEvidence,
)
from app.models.document import Document, DocumentChunk
from app.models.graph import GraphEntity, GraphRelationship
from app.schemas.decision_query import RelatedDecisionResponse
from app.services.decision_search_service import (
    DecisionMatch,
    find_relevant_decisions,
)


@dataclass
class DecisionContextResult:
    context: str
    matched_decisions: list[RelatedDecisionResponse]
    timeline_event_count: int
    graph_node_count: int


def format_json_list(values: list) -> str:
    if not values:
        return "None documented"

    return ", ".join(
        str(value)
        for value in values
    )


def build_decision_section(
    match: DecisionMatch,
) -> str:
    decision = match.decision

    return "\n".join(
        [
            f"DECISION_ID: {decision.id}",
            f"TITLE: {decision.title}",
            f"STATUS: {decision.status}",
            (
                "DECISION DATE: "
                + (
                    decision.decision_date.isoformat()
                    if decision.decision_date
                    else "Unknown"
                )
            ),
            (
                "CONFIDENCE: "
                f"{decision.confidence_score}"
            ),
            (
                "RELEVANCE TO QUESTION: "
                f"{match.relevance_score}"
            ),
            (
                "DECISION STATEMENT: "
                f"{decision.decision_statement}"
            ),
            (
                "SUMMARY: "
                f"{decision.summary or 'Not documented'}"
            ),
            (
                "REASON: "
                f"{decision.reason or 'Not documented'}"
            ),
            (
                "ALTERNATIVES: "
                + format_json_list(
                    decision.alternatives
                )
            ),
            (
                "PARTICIPANTS: "
                + format_json_list(
                    decision.participants
                )
            ),
            (
                "RELATED ENTITIES: "
                + format_json_list(
                    decision.related_entities
                )
            ),
        ]
    )


def get_timeline_context(
    database: Session,
    decision_id: uuid.UUID,
) -> tuple[str, int]:
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
        )
    )

    if not events:
        return "No timeline events recorded.", 0

    sections = []

    for event in events:
        event_date = (
            event.event_date.isoformat()
            if event.event_date
            else "Unknown date"
        )

        sections.append(
            "\n".join(
                [
                    f"- Type: {event.event_type}",
                    f"  Date: {event_date}",
                    f"  Title: {event.title}",
                    (
                        "  Description: "
                        f"{event.description or 'None'}"
                    ),
                ]
            )
        )

    return "\n".join(sections), len(events)


def get_evidence_context(
    database: Session,
    decision_id: uuid.UUID,
) -> str:
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
        .limit(5)
    ).all()

    if not rows:
        return "No linked decision evidence."

    sections = []

    for index, (
        evidence,
        chunk,
        document,
    ) in enumerate(rows, start=1):
        sections.append(
            "\n".join(
                [
                    f"Decision Evidence {index}",
                    (
                        "Document: "
                        f"{document.original_filename}"
                    ),
                    (
                        "Page: "
                        f"{chunk.page_number or 'Unknown'}"
                    ),
                    (
                        "Relevance: "
                        f"{evidence.relevance_score}"
                    ),
                    f"Content: {chunk.content}",
                ]
            )
        )

    return "\n\n".join(sections)


def get_graph_context(
    database: Session,
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> tuple[str, int]:
    decision_entity = database.scalar(
        select(GraphEntity).where(
            GraphEntity.workspace_id
            == workspace_id,
            GraphEntity.entity_type
            == "decision",
            GraphEntity.metadata_json[
                "decision_id"
            ].astext
            == str(decision_id),
        )
    )

    if decision_entity is None:
        return "No graph relationships recorded.", 0

    relationships = list(
        database.scalars(
            select(GraphRelationship).where(
                GraphRelationship.workspace_id
                == workspace_id,
                or_(
                    GraphRelationship.source_entity_id
                    == decision_entity.id,
                    GraphRelationship.target_entity_id
                    == decision_entity.id,
                ),
            )
        )
    )

    connected_ids = set()

    for relationship in relationships:
        connected_ids.add(
            relationship.source_entity_id
        )
        connected_ids.add(
            relationship.target_entity_id
        )

    entities = list(
        database.scalars(
            select(GraphEntity).where(
                GraphEntity.id.in_(connected_ids)
            )
        )
    )

    entity_map = {
        entity.id: entity
        for entity in entities
    }

    sections = []

    for relationship in relationships:
        source = entity_map.get(
            relationship.source_entity_id
        )
        target = entity_map.get(
            relationship.target_entity_id
        )

        if source is None or target is None:
            continue

        sections.append(
            (
                f"{source.name} "
                f"--{relationship.relationship_type}--> "
                f"{target.name}"
            )
        )

    if not sections:
        return "No graph relationships recorded.", 0

    return "\n".join(sections), len(entities)


def build_decision_context(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int = 3,
) -> DecisionContextResult:
    matches = find_relevant_decisions(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limit=limit,
    )

    if not matches:
        return DecisionContextResult(
            context="No structured decisions found.",
            matched_decisions=[],
            timeline_event_count=0,
            graph_node_count=0,
        )

    context_sections = []
    total_timeline_events = 0
    total_graph_nodes = 0
    response_matches = []

    for index, match in enumerate(
        matches,
        start=1,
    ):
        decision = match.decision

        timeline_context, event_count = (
            get_timeline_context(
                database,
                decision.id,
            )
        )

        graph_context, graph_count = (
            get_graph_context(
                database,
                workspace_id,
                decision.id,
            )
        )

        evidence_context = get_evidence_context(
            database,
            decision.id,
        )

        context_sections.append(
            "\n\n".join(
                [
                    f"=== STRUCTURED DECISION {index} ===",
                    build_decision_section(match),
                    "TIMELINE:",
                    timeline_context,
                    "GRAPH RELATIONSHIPS:",
                    graph_context,
                    "LINKED EVIDENCE:",
                    evidence_context,
                ]
            )
        )

        total_timeline_events += event_count
        total_graph_nodes += graph_count

        response_matches.append(
            RelatedDecisionResponse(
                decision_id=decision.id,
                title=decision.title,
                status=decision.status,
                confidence_score=(
                    decision.confidence_score
                ),
                relevance_score=(
                    match.relevance_score
                ),
            )
        )

    return DecisionContextResult(
        context="\n\n".join(context_sections),
        matched_decisions=response_matches,
        timeline_event_count=(
            total_timeline_events
        ),
        graph_node_count=total_graph_nodes,
    )
