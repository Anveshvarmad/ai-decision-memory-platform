import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_workspace_membership
from app.db.dependencies import get_db
from app.models.decision import Decision
from app.models.graph import GraphEntity, GraphRelationship
from app.models.workspace import WorkspaceMember
from app.schemas.graph import (
    GraphBuildResponse,
    GraphEdgeResponse,
    GraphNodeResponse,
    WorkspaceGraphResponse,
)
from app.services.graph_service import build_decision_graph


router = APIRouter(
    prefix="/workspaces/{workspace_id}",
    tags=["Graph"],
)


@router.post(
    "/decisions/{decision_id}/build-graph",
    response_model=GraphBuildResponse,
)
def build_graph(
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> GraphBuildResponse:
    if membership.role not in {
        "owner",
        "admin",
        "member",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to build the graph",
        )

    decision = database.scalar(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.workspace_id == workspace_id,
        )
    )

    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found",
        )

    result = build_decision_graph(
        database=database,
        decision=decision,
    )

    return GraphBuildResponse(**result)


@router.get(
    "/graph",
    response_model=WorkspaceGraphResponse,
)
def get_workspace_graph(
    workspace_id: uuid.UUID,
    entity_type: str | None = None,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> WorkspaceGraphResponse:
    del membership

    entity_statement = select(GraphEntity).where(
        GraphEntity.workspace_id == workspace_id
    )

    if entity_type:
        entity_statement = entity_statement.where(
            GraphEntity.entity_type == entity_type
        )

    entities = list(
        database.scalars(
            entity_statement.order_by(
                GraphEntity.entity_type,
                GraphEntity.name,
            )
        )
    )

    entity_ids = {entity.id for entity in entities}

    relationships = []

    if entity_ids:
        relationships = list(
            database.scalars(
                select(GraphRelationship).where(
                    GraphRelationship.workspace_id
                    == workspace_id,
                    GraphRelationship.source_entity_id.in_(
                        entity_ids
                    ),
                    GraphRelationship.target_entity_id.in_(
                        entity_ids
                    ),
                )
            )
        )

    return WorkspaceGraphResponse(
        nodes=[
            GraphNodeResponse(
                id=entity.id,
                label=entity.name,
                entity_type=entity.entity_type,
                metadata=entity.metadata_json,
            )
            for entity in entities
        ],
        edges=[
            GraphEdgeResponse(
                id=relationship.id,
                source=relationship.source_entity_id,
                target=relationship.target_entity_id,
                relationship_type=(
                    relationship.relationship_type
                ),
                description=relationship.description,
                metadata=relationship.metadata_json,
            )
            for relationship in relationships
        ],
    )


@router.get(
    "/graph/entities/{entity_id}/neighbors",
    response_model=WorkspaceGraphResponse,
)
def get_entity_neighbors(
    workspace_id: uuid.UUID,
    entity_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> WorkspaceGraphResponse:
    del membership

    center = database.scalar(
        select(GraphEntity).where(
            GraphEntity.id == entity_id,
            GraphEntity.workspace_id == workspace_id,
        )
    )

    if center is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph entity not found",
        )

    relationships = list(
        database.scalars(
            select(GraphRelationship).where(
                GraphRelationship.workspace_id
                == workspace_id,
                or_(
                    GraphRelationship.source_entity_id
                    == entity_id,
                    GraphRelationship.target_entity_id
                    == entity_id,
                ),
            )
        )
    )

    connected_ids = {entity_id}

    for relationship in relationships:
        connected_ids.add(
            relationship.source_entity_id
        )
        connected_ids.add(
            relationship.target_entity_id
        )

    entities = list(
        database.scalars(
            select(GraphEntity).where(
                GraphEntity.id.in_(connected_ids)
            )
        )
    )

    return WorkspaceGraphResponse(
        nodes=[
            GraphNodeResponse(
                id=entity.id,
                label=entity.name,
                entity_type=entity.entity_type,
                metadata=entity.metadata_json,
            )
            for entity in entities
        ],
        edges=[
            GraphEdgeResponse(
                id=relationship.id,
                source=relationship.source_entity_id,
                target=relationship.target_entity_id,
                relationship_type=(
                    relationship.relationship_type
                ),
                description=relationship.description,
                metadata=relationship.metadata_json,
            )
            for relationship in relationships
        ],
    )


@router.delete(
    "/graph",
    status_code=status.HTTP_204_NO_CONTENT,
)
def clear_workspace_graph(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> None:
    if membership.role not in {
        "owner",
        "admin",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can clear the graph",
        )

    entities = list(
        database.scalars(
            select(GraphEntity).where(
                GraphEntity.workspace_id == workspace_id
            )
        )
    )

    for entity in entities:
        database.delete(entity)

    database.commit()
