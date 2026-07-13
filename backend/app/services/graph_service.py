import re
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.decision import Decision, DecisionEvidence
from app.models.document import Document, DocumentChunk
from app.models.graph import GraphEntity, GraphRelationship


def normalize_name(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def infer_entity_type(value: str) -> str:
    normalized = value.lower()

    technology_keywords = {
        "postgresql",
        "mongodb",
        "mysql",
        "redis",
        "kafka",
        "docker",
        "kubernetes",
        "graphql",
        "rest",
        "python",
        "java",
    }

    if normalized in technology_keywords:
        return "technology"

    if "incident" in normalized:
        return "incident"

    if "service" in normalized:
        return "service"

    if "project" in normalized:
        return "project"

    return "concept"


def get_or_create_entity(
    database: Session,
    workspace_id: uuid.UUID,
    entity_type: str,
    name: str,
    description: str | None = None,
    metadata_json: dict | None = None,
) -> tuple[GraphEntity, bool]:
    normalized = normalize_name(name)

    existing = database.scalar(
        select(GraphEntity).where(
            GraphEntity.workspace_id == workspace_id,
            GraphEntity.entity_type == entity_type,
            GraphEntity.normalized_name == normalized,
        )
    )

    if existing is not None:
        return existing, False

    entity = GraphEntity(
        workspace_id=workspace_id,
        entity_type=entity_type,
        name=name.strip(),
        normalized_name=normalized,
        description=description,
        metadata_json=metadata_json or {},
    )

    database.add(entity)
    database.flush()

    return entity, True


def create_relationship(
    database: Session,
    workspace_id: uuid.UUID,
    source_entity_id: uuid.UUID,
    target_entity_id: uuid.UUID,
    relationship_type: str,
    description: str | None = None,
    metadata_json: dict | None = None,
) -> tuple[GraphRelationship | None, bool]:
    existing = database.scalar(
        select(GraphRelationship).where(
            GraphRelationship.source_entity_id
            == source_entity_id,
            GraphRelationship.target_entity_id
            == target_entity_id,
            GraphRelationship.relationship_type
            == relationship_type,
        )
    )

    if existing is not None:
        return existing, False

    relationship = GraphRelationship(
        workspace_id=workspace_id,
        source_entity_id=source_entity_id,
        target_entity_id=target_entity_id,
        relationship_type=relationship_type,
        description=description,
        metadata_json=metadata_json or {},
    )

    database.add(relationship)

    try:
        database.flush()
    except IntegrityError:
        database.rollback()
        return None, False

    return relationship, True


def build_decision_graph(
    database: Session,
    decision: Decision,
) -> dict:
    created_entities = 0
    reused_entities = 0
    created_relationships = 0
    skipped_relationships = 0

    decision_entity, created = get_or_create_entity(
        database=database,
        workspace_id=decision.workspace_id,
        entity_type="decision",
        name=decision.title,
        description=decision.decision_statement,
        metadata_json={
            "decision_id": str(decision.id),
            "status": decision.status,
            "confidence_score": decision.confidence_score,
            "decision_date": (
                decision.decision_date.isoformat()
                if decision.decision_date
                else None
            ),
        },
    )

    if created:
        created_entities += 1
    else:
        reused_entities += 1

    for participant in decision.participants:
        if not participant or not str(participant).strip():
            continue

        person_entity, created = get_or_create_entity(
            database=database,
            workspace_id=decision.workspace_id,
            entity_type="person",
            name=str(participant),
        )

        if created:
            created_entities += 1
        else:
            reused_entities += 1

        _, relationship_created = create_relationship(
            database=database,
            workspace_id=decision.workspace_id,
            source_entity_id=person_entity.id,
            target_entity_id=decision_entity.id,
            relationship_type="participated_in",
        )

        if relationship_created:
            created_relationships += 1
        else:
            skipped_relationships += 1

    for related_entity in decision.related_entities:
        if not related_entity or not str(related_entity).strip():
            continue

        related_name = str(related_entity)
        entity_type = infer_entity_type(related_name)

        entity, created = get_or_create_entity(
            database=database,
            workspace_id=decision.workspace_id,
            entity_type=entity_type,
            name=related_name,
        )

        if created:
            created_entities += 1
        else:
            reused_entities += 1

        relationship_type = "related_to"

        if entity_type == "technology":
            relationship_type = "involves_technology"
        elif entity_type == "service":
            relationship_type = "affects_service"
        elif entity_type == "incident":
            relationship_type = "triggered_by"
        elif entity_type == "project":
            relationship_type = "belongs_to_project"

        _, relationship_created = create_relationship(
            database=database,
            workspace_id=decision.workspace_id,
            source_entity_id=decision_entity.id,
            target_entity_id=entity.id,
            relationship_type=relationship_type,
        )

        if relationship_created:
            created_relationships += 1
        else:
            skipped_relationships += 1

    evidence_documents = list(
        database.execute(
            select(Document)
            .join(
                DocumentChunk,
                DocumentChunk.document_id == Document.id,
            )
            .join(
                DecisionEvidence,
                DecisionEvidence.chunk_id == DocumentChunk.id,
            )
            .where(
                DecisionEvidence.decision_id == decision.id
            )
            .distinct()
        ).scalars()
    )

    for document in evidence_documents:
        document_entity, created = get_or_create_entity(
            database=database,
            workspace_id=decision.workspace_id,
            entity_type="document",
            name=document.original_filename,
            metadata_json={
                "document_id": str(document.id),
                "source_type": document.source_type,
                "mime_type": document.mime_type,
            },
        )

        if created:
            created_entities += 1
        else:
            reused_entities += 1

        _, relationship_created = create_relationship(
            database=database,
            workspace_id=decision.workspace_id,
            source_entity_id=document_entity.id,
            target_entity_id=decision_entity.id,
            relationship_type="supports",
        )

        if relationship_created:
            created_relationships += 1
        else:
            skipped_relationships += 1

    database.commit()

    return {
        "decision_id": decision.id,
        "created_entities": created_entities,
        "reused_entities": reused_entities,
        "created_relationships": created_relationships,
        "skipped_relationships": skipped_relationships,
        "status": "completed",
    }
