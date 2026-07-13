import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TimelineGenerationResponse(BaseModel):
    decision_id: uuid.UUID
    status: str
    task_id: str


class DecisionEventResponse(BaseModel):
    id: uuid.UUID
    decision_id: uuid.UUID
    event_type: str
    title: str
    description: str | None
    event_date: datetime | None
    source_reference: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DecisionEventUpdateRequest(BaseModel):
    event_type: str | None = Field(
        default=None,
        max_length=100,
    )
    title: str | None = Field(
        default=None,
        min_length=3,
        max_length=500,
    )
    description: str | None = None
    event_date: datetime | None = None
    source_reference: dict | None = None


class DecisionTimelineResponse(BaseModel):
    decision_id: uuid.UUID
    decision_title: str
    event_count: int
    events: list[DecisionEventResponse]
