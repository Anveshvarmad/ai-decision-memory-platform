import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GraphEntityResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    entity_type: str
    name: str
    normalized_name: str
    description: str | None
    metadata_json: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GraphRelationshipResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    source_entity_id: uuid.UUID
    target_entity_id: uuid.UUID
    relationship_type: str
    description: str | None
    metadata_json: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GraphNodeResponse(BaseModel):
    id: uuid.UUID
    label: str
    entity_type: str
    metadata: dict


class GraphEdgeResponse(BaseModel):
    id: uuid.UUID
    source: uuid.UUID
    target: uuid.UUID
    relationship_type: str
    description: str | None
    metadata: dict


class WorkspaceGraphResponse(BaseModel):
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]


class GraphBuildResponse(BaseModel):
    decision_id: uuid.UUID
    created_entities: int
    reused_entities: int
    created_relationships: int
    skipped_relationships: int
    status: str
