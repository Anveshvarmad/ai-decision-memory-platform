import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Decision(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "decisions"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    decision_statement: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    alternatives: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )

    participants: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )

    related_entities: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="candidate",
        nullable=False,
        index=True,
    )

    confidence_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    decision_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    workspace = relationship(
        "Workspace",
        back_populates="decisions",
    )

    evidence = relationship(
        "DecisionEvidence",
        back_populates="decision",
        cascade="all, delete-orphan",
    )

    events = relationship(
        "DecisionEvent",
        back_populates="decision",
        cascade="all, delete-orphan",
        order_by="DecisionEvent.event_date",
    )


class DecisionEvidence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "decision_evidence"

    decision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("decisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    evidence_type: Mapped[str] = mapped_column(
        String(100),
        default="supporting",
        nullable=False,
    )

    relevance_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    decision = relationship(
        "Decision",
        back_populates="evidence",
    )

    chunk = relationship(
        "DocumentChunk",
        back_populates="evidence_links",
    )

    __table_args__ = (
        UniqueConstraint(
            "decision_id",
            "chunk_id",
            name="uq_decision_evidence_chunk",
        ),
    )


class DecisionEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "decision_events"

    decision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("decisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    event_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    source_reference: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    decision = relationship(
        "Decision",
        back_populates="events",
    )
