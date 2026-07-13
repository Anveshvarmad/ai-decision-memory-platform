import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime
    role: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
