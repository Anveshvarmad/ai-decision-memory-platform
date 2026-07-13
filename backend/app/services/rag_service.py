import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.schemas.chat import CitationResponse
from app.schemas.decision_query import (
    DecisionQueryClassification,
    RelatedDecisionResponse,
)
from app.services.decision_context_service import (
    build_decision_context,
)
from app.services.llm_service import (
    generate_decision_aware_answer,
)
from app.services.query_classifier import (
    classify_decision_query,
)
from app.services.search_service import hybrid_search


INSUFFICIENT_EVIDENCE_MESSAGE = (
    "I could not find enough evidence in the workspace "
    "to answer this question."
)


@dataclass
class RAGAnswerResult:
    answer: str
    citations: list[CitationResponse]
    evidence_found: bool
    classification: DecisionQueryClassification
    matched_decisions: list[RelatedDecisionResponse]
    timeline_event_count: int
    graph_node_count: int
    document_result_count: int


def build_document_context(
    results,
) -> tuple[str, list[CitationResponse]]:
    context_parts = []
    citations = []

    for index, result in enumerate(
        results,
        start=1,
    ):
        location_parts = []

        if result.page_number is not None:
            location_parts.append(
                f"Page {result.page_number}"
            )

        if result.section_title:
            location_parts.append(
                result.section_title
            )

        location = (
            ", ".join(location_parts)
            if location_parts
            else "Location unavailable"
        )

        similarity = (
            result.semantic_similarity
            if result.semantic_similarity
            is not None
            else 0.0
        )

        context_parts.append(
            "\n".join(
                [
                    f"[{index}]",
                    (
                        "Document: "
                        f"{result.document_name}"
                    ),
                    f"Location: {location}",
                    (
                        "Matched by: "
                        + ", ".join(
                            result.matched_by
                        )
                    ),
                    f"Content: {result.content}",
                ]
            )
        )

        excerpt = result.content[:500]

        if len(result.content) > 500:
            excerpt += "..."

        citations.append(
            CitationResponse(
                citation_number=index,
                chunk_id=result.chunk_id,
                document_id=result.document_id,
                document_name=(
                    result.document_name
                ),
                page_number=result.page_number,
                section_title=(
                    result.section_title
                ),
                excerpt=excerpt,
                similarity=similarity,
            )
        )

    return (
        "\n\n---\n\n".join(context_parts),
        citations,
    )


def answer_question(
    database: Session,
    workspace_id: uuid.UUID,
    question: str,
    limit: int,
    minimum_similarity: float,
) -> RAGAnswerResult:
    classification = classify_decision_query(
        question
    )

    decision_context = build_decision_context(
        database=database,
        workspace_id=workspace_id,
        query=question,
        limit=3,
    )

    document_results, _, _ = hybrid_search(
        database=database,
        workspace_id=workspace_id,
        query=question,
        limit=limit,
        semantic_limit=max(limit * 3, 10),
        keyword_limit=max(limit * 3, 10),
        minimum_similarity=minimum_similarity,
        rrf_k=60,
    )

    document_context, citations = (
        build_document_context(
            document_results
        )
    )

    has_decisions = bool(
        decision_context.matched_decisions
    )

    has_documents = bool(document_results)

    if not has_decisions and not has_documents:
        return RAGAnswerResult(
            answer=INSUFFICIENT_EVIDENCE_MESSAGE,
            citations=[],
            evidence_found=False,
            classification=classification,
            matched_decisions=[],
            timeline_event_count=0,
            graph_node_count=0,
            document_result_count=0,
        )

    answer = generate_decision_aware_answer(
        question=question,
        query_type=classification.query_type,
        decision_context=decision_context.context,
        document_context=(
            document_context
            or "No additional document evidence."
        ),
    )

    return RAGAnswerResult(
        answer=answer,
        citations=citations,
        evidence_found=True,
        classification=classification,
        matched_decisions=(
            decision_context.matched_decisions
        ),
        timeline_event_count=(
            decision_context.timeline_event_count
        ),
        graph_node_count=(
            decision_context.graph_node_count
        ),
        document_result_count=len(
            document_results
        ),
    )
