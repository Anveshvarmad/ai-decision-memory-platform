import re
import uuid
from dataclasses import dataclass

from sqlalchemy import Float, cast, func, literal, select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.schemas.search import (
    HybridSearchResult,
    SemanticSearchResult,
)
from app.services.embedding_service import generate_embedding


@dataclass
class SearchCandidate:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    source_type: str
    chunk_index: int
    content: str
    page_number: int | None
    section_title: str | None

    semantic_rank: int | None = None
    semantic_similarity: float | None = None

    keyword_rank: int | None = None
    keyword_score: float | None = None

    exact_match: bool = False


def normalize_exact_query(value: str) -> str:
    return " ".join(value.lower().split())


def extract_exact_terms(query: str) -> list[str]:
    quoted_terms = re.findall(
        r'"([^"]+)"',
        query,
    )

    identifiers = re.findall(
        r"\b[A-Za-z]+-\d+\b|\bPR\s*#?\d+\b",
        query,
        flags=re.IGNORECASE,
    )

    proper_terms = re.findall(
        r"\b(?:PostgreSQL|MongoDB|MySQL|Redis|Kafka|"
        r"Kubernetes|Docker|GraphQL|REST)\b",
        query,
        flags=re.IGNORECASE,
    )

    terms = quoted_terms + identifiers + proper_terms

    unique_terms: list[str] = []
    seen: set[str] = set()

    for term in terms:
        normalized = normalize_exact_query(term)

        if normalized and normalized not in seen:
            unique_terms.append(normalized)
            seen.add(normalized)

    return unique_terms


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


def get_semantic_candidates(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int,
    minimum_similarity: float,
    document_ids: list[uuid.UUID] | None,
    source_types: list[str] | None,
) -> list[SearchCandidate]:
    query_embedding = generate_embedding(query)

    distance_expression = (
        DocumentChunk.embedding.cosine_distance(
            query_embedding
        )
    )

    statement = (
        select(
            DocumentChunk,
            Document,
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

    if source_types:
        statement = statement.where(
            Document.source_type.in_(source_types)
        )

    rows = database.execute(statement).all()

    candidates: list[SearchCandidate] = []

    for rank, (chunk, document, distance) in enumerate(
        rows,
        start=1,
    ):
        similarity = 1.0 - float(distance)

        if similarity < minimum_similarity:
            continue

        candidates.append(
            SearchCandidate(
                chunk_id=chunk.id,
                document_id=document.id,
                document_name=document.original_filename,
                source_type=document.source_type,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                page_number=chunk.page_number,
                section_title=chunk.section_title,
                semantic_rank=rank,
                semantic_similarity=round(
                    similarity,
                    6,
                ),
            )
        )

    return candidates


def get_keyword_candidates(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int,
    document_ids: list[uuid.UUID] | None,
    source_types: list[str] | None,
) -> list[SearchCandidate]:
    websearch_query = func.websearch_to_tsquery(
        "english",
        query,
    )

    rank_expression = func.ts_rank_cd(
        literal_column_search_vector(),
        websearch_query,
    )

    statement = (
        select(
            DocumentChunk,
            Document,
            cast(
                rank_expression,
                Float,
            ).label("keyword_score"),
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.workspace_id == workspace_id,
            Document.status == "completed",
            literal_column_search_vector().op("@@")(
                websearch_query
            ),
        )
        .order_by(rank_expression.desc())
        .limit(limit)
    )

    if document_ids:
        statement = statement.where(
            Document.id.in_(document_ids)
        )

    if source_types:
        statement = statement.where(
            Document.source_type.in_(source_types)
        )

    rows = database.execute(statement).all()
    exact_terms = extract_exact_terms(query)

    candidates: list[SearchCandidate] = []

    for rank, (chunk, document, keyword_score) in enumerate(
        rows,
        start=1,
    ):
        normalized_content = normalize_exact_query(
            chunk.content
        )

        exact_match = any(
            term in normalized_content
            for term in exact_terms
        )

        candidates.append(
            SearchCandidate(
                chunk_id=chunk.id,
                document_id=document.id,
                document_name=document.original_filename,
                source_type=document.source_type,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                page_number=chunk.page_number,
                section_title=chunk.section_title,
                keyword_rank=rank,
                keyword_score=round(
                    float(keyword_score or 0.0),
                    6,
                ),
                exact_match=exact_match,
            )
        )

    return candidates


def literal_column_search_vector():
    from sqlalchemy import literal_column

    return literal_column(
        "document_chunks.search_vector"
    )


def reciprocal_rank_fusion(
    semantic_candidates: list[SearchCandidate],
    keyword_candidates: list[SearchCandidate],
    limit: int,
    rrf_k: int,
) -> list[HybridSearchResult]:
    combined: dict[uuid.UUID, SearchCandidate] = {}

    for candidate in semantic_candidates:
        combined[candidate.chunk_id] = candidate

    for candidate in keyword_candidates:
        existing = combined.get(candidate.chunk_id)

        if existing is None:
            combined[candidate.chunk_id] = candidate
            continue

        existing.keyword_rank = candidate.keyword_rank
        existing.keyword_score = candidate.keyword_score
        existing.exact_match = candidate.exact_match

    scored_results: list[
        tuple[float, SearchCandidate]
    ] = []

    for candidate in combined.values():
        fused_score = 0.0

        if candidate.semantic_rank is not None:
            fused_score += 1.0 / (
                rrf_k + candidate.semantic_rank
            )

        if candidate.keyword_rank is not None:
            fused_score += 1.0 / (
                rrf_k + candidate.keyword_rank
            )

        if candidate.exact_match:
            fused_score += 0.02

        scored_results.append(
            (
                fused_score,
                candidate,
            )
        )

    scored_results.sort(
        key=lambda item: (
            item[0],
            item[1].semantic_similarity or 0.0,
            item[1].keyword_score or 0.0,
        ),
        reverse=True,
    )

    results: list[HybridSearchResult] = []

    for fused_score, candidate in scored_results[:limit]:
        matched_by: list[str] = []

        if candidate.semantic_rank is not None:
            matched_by.append("semantic")

        if candidate.keyword_rank is not None:
            matched_by.append("keyword")

        if candidate.exact_match:
            matched_by.append("exact")

        results.append(
            HybridSearchResult(
                chunk_id=candidate.chunk_id,
                document_id=candidate.document_id,
                document_name=candidate.document_name,
                source_type=candidate.source_type,
                chunk_index=candidate.chunk_index,
                content=candidate.content,
                page_number=candidate.page_number,
                section_title=candidate.section_title,
                semantic_rank=candidate.semantic_rank,
                semantic_similarity=(
                    candidate.semantic_similarity
                ),
                keyword_rank=candidate.keyword_rank,
                keyword_score=candidate.keyword_score,
                exact_match=candidate.exact_match,
                fused_score=round(
                    fused_score,
                    8,
                ),
                matched_by=matched_by,
            )
        )

    return results


def hybrid_search(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int,
    semantic_limit: int,
    keyword_limit: int,
    minimum_similarity: float,
    rrf_k: int,
    document_ids: list[uuid.UUID] | None = None,
    source_types: list[str] | None = None,
) -> tuple[
    list[HybridSearchResult],
    int,
    int,
]:
    semantic_candidates = get_semantic_candidates(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limit=semantic_limit,
        minimum_similarity=minimum_similarity,
        document_ids=document_ids,
        source_types=source_types,
    )

    keyword_candidates = get_keyword_candidates(
        database=database,
        workspace_id=workspace_id,
        query=query,
        limit=keyword_limit,
        document_ids=document_ids,
        source_types=source_types,
    )

    results = reciprocal_rank_fusion(
        semantic_candidates=semantic_candidates,
        keyword_candidates=keyword_candidates,
        limit=limit,
        rrf_k=rrf_k,
    )

    return (
        results,
        len(semantic_candidates),
        len(keyword_candidates),
    )
