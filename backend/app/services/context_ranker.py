import hashlib
import math
import re
import uuid
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from app.schemas.context import (
    AggregatedContextResponse,
    RankedContextItem,
    RankedContextResponse,
)


@dataclass
class RankingOptions:
    token_budget: int = 6000
    maximum_items: int = 30
    deduplication_threshold: float = 0.88


def normalize_text(value: str) -> str:
    normalized = value.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = re.sub(
        r"[^\w\s\-]",
        "",
        normalized,
    )
    return normalized


def estimate_tokens(value: str) -> int:
    if not value:
        return 0

    return max(
        1,
        math.ceil(len(value) / 4),
    )


def stable_source_id(
    source_type: str,
    identifier: str,
) -> str:
    raw_value = f"{source_type}:{identifier}"

    digest = hashlib.sha256(
        raw_value.encode("utf-8")
    ).hexdigest()[:16]

    return f"{source_type}-{digest}"


def text_similarity(
    left: str,
    right: str,
) -> float:
    normalized_left = normalize_text(left)
    normalized_right = normalize_text(right)

    if not normalized_left or not normalized_right:
        return 0.0

    if normalized_left == normalized_right:
        return 1.0

    return SequenceMatcher(
        None,
        normalized_left,
        normalized_right,
    ).ratio()


def calculate_decision_score(
    relevance_score: float,
    confidence_score: float,
    status: str,
    evidence_count: int,
    timeline_count: int,
    graph_count: int,
) -> tuple[float, dict[str, float]]:
    relevance_component = (
        max(0.0, relevance_score) * 0.45
    )

    confidence_component = (
        max(0.0, confidence_score) * 0.2
    )

    status_component = {
        "approved": 0.15,
        "candidate": 0.06,
        "rejected": -0.05,
    }.get(status, 0.0)

    evidence_component = min(
        evidence_count * 0.025,
        0.1,
    )

    structural_component = min(
        (
            timeline_count * 0.01
            + graph_count * 0.005
        ),
        0.1,
    )

    components = {
        "relevance": relevance_component,
        "confidence": confidence_component,
        "status": status_component,
        "evidence": evidence_component,
        "structure": structural_component,
    }

    return (
        round(sum(components.values()), 6),
        components,
    )


def calculate_document_score(
    fused_score: float,
    semantic_similarity: float | None,
    keyword_score: float | None,
    exact_match: bool,
    matched_by: list[str],
) -> tuple[float, dict[str, float]]:
    fusion_component = min(
        max(fused_score, 0.0) * 8.0,
        0.35,
    )

    semantic_component = (
        max(semantic_similarity or 0.0, 0.0)
        * 0.35
    )

    keyword_component = min(
        max(keyword_score or 0.0, 0.0)
        * 0.15,
        0.15,
    )

    exact_component = (
        0.15 if exact_match else 0.0
    )

    multi_retrieval_component = (
        0.05
        if len(set(matched_by)) >= 2
        else 0.0
    )

    components = {
        "fusion": fusion_component,
        "semantic": semantic_component,
        "keyword": keyword_component,
        "exact_match": exact_component,
        "multi_retrieval": (
            multi_retrieval_component
        ),
    }

    return (
        round(sum(components.values()), 6),
        components,
    )


def calculate_evidence_score(
    relevance_score: float,
    decision_score: float,
) -> tuple[float, dict[str, float]]:
    evidence_component = (
        max(relevance_score, 0.0) * 0.6
    )

    parent_component = (
        max(decision_score, 0.0) * 0.4
    )

    components = {
        "evidence_relevance": (
            evidence_component
        ),
        "parent_decision": parent_component,
    }

    return (
        round(sum(components.values()), 6),
        components,
    )


def aggregate_to_candidates(
    context: AggregatedContextResponse,
) -> list[RankedContextItem]:
    candidates: list[RankedContextItem] = []

    for decision in context.decisions:
        decision_content = "\n".join(
            [
                f"Decision: {decision.title}",
                (
                    "Statement: "
                    f"{decision.decision_statement}"
                ),
                (
                    "Summary: "
                    f"{decision.summary or 'Unknown'}"
                ),
                (
                    "Reason: "
                    f"{decision.reason or 'Unknown'}"
                ),
                (
                    "Alternatives: "
                    + ", ".join(
                        str(value)
                        for value
                        in decision.alternatives
                    )
                ),
                (
                    "Participants: "
                    + ", ".join(
                        str(value)
                        for value
                        in decision.participants
                    )
                ),
                (
                    "Related entities: "
                    + ", ".join(
                        str(value)
                        for value
                        in decision.related_entities
                    )
                ),
            ]
        )

        decision_score, components = (
            calculate_decision_score(
                relevance_score=(
                    decision.relevance_score
                ),
                confidence_score=(
                    decision.confidence_score
                ),
                status=decision.status,
                evidence_count=len(
                    decision.evidence
                ),
                timeline_count=len(
                    decision.timeline
                ),
                graph_count=len(
                    decision.graph_relationships
                ),
            )
        )

        candidates.append(
            RankedContextItem(
                source_id=stable_source_id(
                    "decision",
                    str(decision.decision_id),
                ),
                source_type="decision",
                title=decision.title,
                content=decision_content,
                score=decision_score,
                token_estimate=estimate_tokens(
                    decision_content
                ),
                decision_id=(
                    decision.decision_id
                ),
                metadata={
                    "status": decision.status,
                    "confidence_score": (
                        decision.confidence_score
                    ),
                    "decision_date": (
                        decision.decision_date.isoformat()
                        if decision.decision_date
                        else None
                    ),
                },
                score_components=components,
            )
        )

        for evidence in decision.evidence:
            evidence_score, evidence_components = (
                calculate_evidence_score(
                    relevance_score=(
                        evidence.relevance_score
                    ),
                    decision_score=decision_score,
                )
            )

            candidates.append(
                RankedContextItem(
                    source_id=stable_source_id(
                        "decision_evidence",
                        str(evidence.evidence_id),
                    ),
                    source_type=(
                        "decision_evidence"
                    ),
                    title=(
                        f"Evidence from "
                        f"{evidence.document_name}"
                    ),
                    content=evidence.content,
                    score=evidence_score,
                    token_estimate=estimate_tokens(
                        evidence.content
                    ),
                    decision_id=(
                        decision.decision_id
                    ),
                    document_id=(
                        evidence.document_id
                    ),
                    chunk_id=evidence.chunk_id,
                    metadata={
                        "document_name": (
                            evidence.document_name
                        ),
                        "page_number": (
                            evidence.page_number
                        ),
                        "section_title": (
                            evidence.section_title
                        ),
                        "evidence_type": (
                            evidence.evidence_type
                        ),
                        "explanation": (
                            evidence.explanation
                        ),
                    },
                    score_components=(
                        evidence_components
                    ),
                )
            )

        for event in decision.timeline:
            event_content = "\n".join(
                [
                    f"Timeline event: {event.title}",
                    (
                        "Type: "
                        f"{event.event_type}"
                    ),
                    (
                        "Date: "
                        + (
                            event.event_date.isoformat()
                            if event.event_date
                            else "Unknown"
                        )
                    ),
                    (
                        "Description: "
                        f"{event.description or 'None'}"
                    ),
                ]
            )

            event_score = min(
                decision_score * 0.75 + 0.1,
                1.0,
            )

            candidates.append(
                RankedContextItem(
                    source_id=stable_source_id(
                        "timeline_event",
                        str(event.event_id),
                    ),
                    source_type="timeline_event",
                    title=event.title,
                    content=event_content,
                    score=round(
                        event_score,
                        6,
                    ),
                    token_estimate=estimate_tokens(
                        event_content
                    ),
                    decision_id=(
                        decision.decision_id
                    ),
                    metadata={
                        "event_type": (
                            event.event_type
                        ),
                        "event_date": (
                            event.event_date.isoformat()
                            if event.event_date
                            else None
                        ),
                        "source_reference": (
                            event.source_reference
                        ),
                    },
                    score_components={
                        "parent_decision": round(
                            decision_score * 0.75,
                            6,
                        ),
                        "timeline_bonus": 0.1,
                    },
                )
            )

        for relationship in (
            decision.graph_relationships
        ):
            relationship_content = (
                f"{relationship.source_name} "
                f"--{relationship.relationship_type}--> "
                f"{relationship.target_name}"
            )

            relationship_score = min(
                decision_score * 0.65 + 0.08,
                1.0,
            )

            candidates.append(
                RankedContextItem(
                    source_id=stable_source_id(
                        "graph_relationship",
                        str(
                            relationship
                            .relationship_id
                        ),
                    ),
                    source_type=(
                        "graph_relationship"
                    ),
                    title=relationship_content,
                    content=relationship_content,
                    score=round(
                        relationship_score,
                        6,
                    ),
                    token_estimate=estimate_tokens(
                        relationship_content
                    ),
                    decision_id=(
                        decision.decision_id
                    ),
                    metadata={
                        "source_entity_id": str(
                            relationship
                            .source_entity_id
                        ),
                        "source_type": (
                            relationship.source_type
                        ),
                        "relationship_type": (
                            relationship
                            .relationship_type
                        ),
                        "target_entity_id": str(
                            relationship
                            .target_entity_id
                        ),
                        "target_type": (
                            relationship.target_type
                        ),
                    },
                    score_components={
                        "parent_decision": round(
                            decision_score * 0.65,
                            6,
                        ),
                        "graph_bonus": 0.08,
                    },
                )
            )

    for document in context.documents:
        document_score, components = (
            calculate_document_score(
                fused_score=(
                    document.fused_score
                ),
                semantic_similarity=(
                    document.semantic_similarity
                ),
                keyword_score=(
                    document.keyword_score
                ),
                exact_match=(
                    document.exact_match
                ),
                matched_by=(
                    document.matched_by
                ),
            )
        )

        candidates.append(
            RankedContextItem(
                source_id=stable_source_id(
                    "document_chunk",
                    str(document.chunk_id),
                ),
                source_type="document_chunk",
                title=(
                    f"Document: "
                    f"{document.document_name}"
                ),
                content=document.content,
                score=document_score,
                token_estimate=estimate_tokens(
                    document.content
                ),
                document_id=(
                    document.document_id
                ),
                chunk_id=document.chunk_id,
                metadata={
                    "document_name": (
                        document.document_name
                    ),
                    "source_type": (
                        document.source_type
                    ),
                    "chunk_index": (
                        document.chunk_index
                    ),
                    "page_number": (
                        document.page_number
                    ),
                    "section_title": (
                        document.section_title
                    ),
                    "matched_by": (
                        document.matched_by
                    ),
                },
                score_components=components,
            )
        )

    return candidates


def deduplicate_candidates(
    candidates: list[RankedContextItem],
    threshold: float,
) -> tuple[
    list[RankedContextItem],
    int,
]:
    ordered = sorted(
        candidates,
        key=lambda item: item.score,
        reverse=True,
    )

    selected: list[RankedContextItem] = []
    removed_count = 0

    seen_chunk_ids: set[uuid.UUID] = set()

    for candidate in ordered:
        if (
            candidate.chunk_id is not None
            and candidate.chunk_id
            in seen_chunk_ids
        ):
            removed_count += 1
            continue

        duplicate_found = any(
            text_similarity(
                candidate.content,
                selected_item.content,
            )
            >= threshold
            for selected_item in selected
        )

        if duplicate_found:
            removed_count += 1
            continue

        selected.append(candidate)

        if candidate.chunk_id is not None:
            seen_chunk_ids.add(
                candidate.chunk_id
            )

    return selected, removed_count


def select_with_token_budget(
    candidates: list[RankedContextItem],
    token_budget: int,
    maximum_items: int,
) -> tuple[
    list[RankedContextItem],
    int,
]:
    selected: list[RankedContextItem] = []
    used_tokens = 0

    source_types: set[str] = set()

    ordered = sorted(
        candidates,
        key=lambda item: (
            item.score,
            -item.token_estimate,
        ),
        reverse=True,
    )

    priority_types = [
        "decision",
        "decision_evidence",
        "document_chunk",
        "timeline_event",
        "graph_relationship",
    ]

    for source_type in priority_types:
        matching = [
            item
            for item in ordered
            if item.source_type == source_type
            and item.source_type
            not in source_types
        ]

        if not matching:
            continue

        candidate = matching[0]

        if (
            used_tokens
            + candidate.token_estimate
            <= token_budget
        ):
            selected.append(candidate)
            used_tokens += (
                candidate.token_estimate
            )
            source_types.add(
                candidate.source_type
            )

    selected_ids = {
        item.source_id
        for item in selected
    }

    for candidate in ordered:
        if len(selected) >= maximum_items:
            break

        if candidate.source_id in selected_ids:
            continue

        if (
            used_tokens
            + candidate.token_estimate
            > token_budget
        ):
            continue

        selected.append(candidate)
        selected_ids.add(candidate.source_id)
        used_tokens += candidate.token_estimate

    selected.sort(
        key=lambda item: item.score,
        reverse=True,
    )

    return selected, used_tokens


def rank_context(
    context: AggregatedContextResponse,
    options: RankingOptions | None = None,
) -> RankedContextResponse:
    resolved_options = (
        options or RankingOptions()
    )

    candidates = aggregate_to_candidates(
        context
    )

    (
        deduplicated_candidates,
        removed_duplicates,
    ) = deduplicate_candidates(
        candidates=candidates,
        threshold=(
            resolved_options
            .deduplication_threshold
        ),
    )

    (
        selected_items,
        estimated_tokens,
    ) = select_with_token_budget(
        candidates=deduplicated_candidates,
        token_budget=(
            resolved_options.token_budget
        ),
        maximum_items=(
            resolved_options.maximum_items
        ),
    )

    return RankedContextResponse(
        query=context.query,
        query_type=context.query_type,
        classification_confidence=(
            context.classification_confidence
        ),
        ranked_items=selected_items,
        total_candidates=len(candidates),
        selected_items=len(selected_items),
        estimated_tokens=estimated_tokens,
        token_budget=(
            resolved_options.token_budget
        ),
        removed_duplicates=(
            removed_duplicates
        ),
        source_counts=context.source_counts,
        evidence_found=bool(selected_items),
    )
