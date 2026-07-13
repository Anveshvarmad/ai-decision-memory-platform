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
