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
