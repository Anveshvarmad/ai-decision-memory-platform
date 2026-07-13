import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    original_filename: str
    mime_type: str
    file_size: int
    source_type: str
    status: str
    processing_progress: int
    error_message: str | None
    metadata_json: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    chunk_count: int = 0


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    task_id: str


class DocumentRetryResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    task_id: str


class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str
    token_count: int | None
    page_number: int | None
    section_title: str | None
    metadata_json: dict

    model_config = ConfigDict(from_attributes=True)
