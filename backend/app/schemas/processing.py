import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentProcessingEvent(BaseModel):
    event_type: str
    document_id: uuid.UUID
    workspace_id: uuid.UUID

    status: str
    progress: int = Field(
        ge=0,
        le=100,
    )

    stage: str
    message: str

    chunk_count: int | None = None
    error_message: str | None = None

    terminal: bool = False
    timestamp: datetime


class WorkspaceProcessingDocument(BaseModel):
    document_id: uuid.UUID
    workspace_id: uuid.UUID
    filename: str
    status: str
    progress: int = Field(ge=0, le=100)
    stage: str
    message: str
    chunk_count: int | None = None
    error_message: str | None = None
    terminal: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WorkspaceProcessingEvent(BaseModel):
    event_type: str = "workspace.processing.snapshot"
    workspace_id: uuid.UUID
    active_documents: list[
        WorkspaceProcessingDocument
    ] = Field(default_factory=list)
    recent_documents: list[
        WorkspaceProcessingDocument
    ] = Field(default_factory=list)
    active_count: int = 0
    completed_count: int = 0
    failed_count: int = 0
    timestamp: datetime
