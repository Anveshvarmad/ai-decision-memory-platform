import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DecisionEvidenceResponse(BaseModel):
    id: uuid.UUID
    chunk_id: uuid.UUID
    evidence_type: str
    relevance_score: float
    explanation: str | None
    document_id: uuid.UUID
    document_name: str
    chunk_index: int
    content: str
    page_number: int | None
    section_title: str | None


class DecisionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    summary: str | None
    decision_statement: str
    reason: str | None
    alternatives: list
    participants: list
    related_entities: list
    status: str
    confidence_score: float
    decision_date: datetime | None
    reviewed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DecisionDetailResponse(DecisionResponse):
    evidence: list[DecisionEvidenceResponse]


class DecisionExtractionResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    task_id: str


class DecisionReviewRequest(BaseModel):
    status: str = Field(
        pattern="^(approved|rejected|candidate)$"
    )


class DecisionUpdateRequest(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=3,
        max_length=500,
    )

    summary: str | None = None
    decision_statement: str | None = None
    reason: str | None = None
    alternatives: list[str] | None = None
    participants: list[str] | None = None
    related_entities: list[str] | None = None
    decision_date: datetime | None = None


class DecisionStatsResponse(BaseModel):
    total: int
    candidates: int
    approved: int
    rejected: int
    average_confidence: float
