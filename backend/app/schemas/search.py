import uuid

from pydantic import BaseModel, Field


class SemanticSearchRequest(BaseModel):
    query: str = Field(
        min_length=2,
        max_length=2000,
    )

    limit: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    document_ids: list[uuid.UUID] | None = None

    minimum_similarity: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
    )


class SemanticSearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    chunk_index: int
    content: str
    page_number: int | None
    section_title: str | None
    distance: float
    similarity: float


class SemanticSearchResponse(BaseModel):
    query: str
    result_count: int
    results: list[SemanticSearchResult]


class HybridSearchRequest(BaseModel):
    query: str = Field(
        min_length=2,
        max_length=2000,
    )

    limit: int = Field(
        default=8,
        ge=1,
        le=20,
    )

    semantic_limit: int = Field(
        default=20,
        ge=1,
        le=50,
    )

    keyword_limit: int = Field(
        default=20,
        ge=1,
        le=50,
    )

    document_ids: list[uuid.UUID] | None = None

    source_types: list[str] | None = None

    minimum_similarity: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
    )

    rrf_k: int = Field(
        default=60,
        ge=1,
        le=200,
    )


class HybridSearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    source_type: str
    chunk_index: int
    content: str
    page_number: int | None
    section_title: str | None

    semantic_rank: int | None
    semantic_similarity: float | None

    keyword_rank: int | None
    keyword_score: float | None

    exact_match: bool
    fused_score: float
    matched_by: list[str]


class HybridSearchResponse(BaseModel):
    query: str
    result_count: int
    semantic_candidates: int
    keyword_candidates: int
    results: list[HybridSearchResult]


class SearchComparisonResponse(BaseModel):
    query: str
    semantic_results: list[SemanticSearchResult]
    hybrid_results: list[HybridSearchResult]
