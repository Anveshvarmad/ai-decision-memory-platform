import uuid

from sqlalchemy.orm import Session

from app.schemas.chat import CitationResponse
from app.services.llm_service import generate_answer
from app.services.search_service import semantic_search


INSUFFICIENT_EVIDENCE_MESSAGE = (
    "I could not find enough evidence in the workspace "
    "to answer this question."
)


def build_context(
    results,
) -> tuple[str, list[CitationResponse]]:
    context_parts: list[str] = []
    citations: list[CitationResponse] = []

    for index, result in enumerate(results, start=1):
        location_parts: list[str] = []

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

        context_parts.append(
            "\n".join(
                [
                    f"[{index}]",
                    f"Document: {result.document_name}",
                    f"Location: {location}",
                    f"Similarity: {result.similarity}",
                    "Content:",
                    result.content,
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
                document_name=result.document_name,
                page_number=result.page_number,
                section_title=result.section_title,
                excerpt=excerpt,
                similarity=result.similarity,
            )
        )

    return "\n\n---\n\n".join(context_parts), citations


def answer_question(
    database: Session,
    workspace_id: uuid.UUID,
    question: str,
    limit: int,
    minimum_similarity: float,
) -> tuple[str, list[CitationResponse], bool]:
    results = semantic_search(
        database=database,
        workspace_id=workspace_id,
        query=question,
        limit=limit,
        minimum_similarity=minimum_similarity,
    )

    if not results:
        return (
            INSUFFICIENT_EVIDENCE_MESSAGE,
            [],
            False,
        )

    context, citations = build_context(results)

    answer = generate_answer(
        question=question,
        context=context,
    )

    return answer, citations, True
