import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.schemas.search import SemanticSearchResult
from app.services.embedding_service import generate_embedding


def semantic_search(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int,
    minimum_similarity: float,
    document_ids: list[uuid.UUID] | None = None,
) -> list[SemanticSearchResult]:
    query_embedding = generate_embedding(query)

    distance_expression = (
        DocumentChunk.embedding.cosine_distance(
            query_embedding
        )
    )

    statement = (
        select(
            DocumentChunk,
            Document.original_filename,
            distance_expression.label("distance"),
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.workspace_id == workspace_id,
            Document.status == "completed",
            DocumentChunk.embedding.is_not(None),
        )
        .order_by(distance_expression)
        .limit(limit)
    )

    if document_ids:
        statement = statement.where(
            Document.id.in_(document_ids)
        )

    rows = database.execute(statement).all()

    results: list[SemanticSearchResult] = []

    for chunk, document_name, distance in rows:
        numeric_distance = float(distance)
        similarity = 1.0 - numeric_distance

        if similarity < minimum_similarity:
            continue

        results.append(
            SemanticSearchResult(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_name=document_name,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                page_number=chunk.page_number,
                section_title=chunk.section_title,
                distance=round(numeric_distance, 6),
                similarity=round(similarity, 6),
            )
        )

    return results
