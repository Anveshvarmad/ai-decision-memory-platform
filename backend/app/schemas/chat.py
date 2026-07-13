import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CitationResponse(BaseModel):
    citation_number: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page_number: int | None
    section_title: str | None
    excerpt: str
    similarity: float


class ChatRequest(BaseModel):
    question: str = Field(
        min_length=2,
        max_length=4000,
    )

    conversation_id: uuid.UUID | None = None

    limit: int = Field(
        default=5,
        ge=1,
        le=10,
    )

    minimum_similarity: float = Field(
        default=0.2,
        ge=-1.0,
        le=1.0,
    )


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    question: str
    answer: str
    citations: list[CitationResponse]
    evidence_found: bool


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list
    metadata_json: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse]
