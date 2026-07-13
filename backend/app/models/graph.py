import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class GraphEntity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "graph_entities"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    entity_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    normalized_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    metadata_json: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    outgoing_relationships = relationship(
        "GraphRelationship",
        foreign_keys="GraphRelationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan",
    )

    incoming_relationships = relationship(
        "GraphRelationship",
        foreign_keys="GraphRelationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "entity_type",
            "normalized_name",
            name="uq_graph_entity_workspace_type_name",
        ),
    )


class GraphRelationship(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "graph_relationships"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("graph_entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    target_entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("graph_entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    relationship_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    metadata_json: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    source_entity = relationship(
        "GraphEntity",
        foreign_keys=[source_entity_id],
        back_populates="outgoing_relationships",
    )

    target_entity = relationship(
        "GraphEntity",
        foreign_keys=[target_entity_id],
        back_populates="incoming_relationships",
    )

    __table_args__ = (
        UniqueConstraint(
            "source_entity_id",
            "target_entity_id",
            "relationship_type",
            name="uq_graph_relationship",
        ),
    )
