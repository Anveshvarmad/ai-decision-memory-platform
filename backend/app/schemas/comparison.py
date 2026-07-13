import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.context import ReasoningCitation


class DecisionComparisonRequest(BaseModel):
    decision_a_id: uuid.UUID
    decision_b_id: uuid.UUID

    question: str = Field(
        default=(
            "Compare these decisions and explain "
            "what changed."
        ),
        min_length=2,
        max_length=2000,
    )

    evidence_limit: int = Field(
        default=8,
        ge=1,
        le=25,
    )

    timeline_limit: int = Field(
        default=20,
        ge=1,
        le=100,
    )


class ComparisonClaim(BaseModel):
    text: str
    source_ids: list[str] = Field(
        default_factory=list
    )
    supported: bool = False


class DecisionComparisonSnapshot(BaseModel):
    decision_id: uuid.UUID
    title: str
    status: str
    summary: str | None
    decision_statement: str
    reason: str | None
    alternatives: list[Any]
    participants: list[Any]
    related_entities: list[Any]
    confidence_score: float
    decision_date: str | None
    evidence_count: int
    timeline_event_count: int


class DecisionComparisonResult(BaseModel):
    executive_summary: str
    comparison_answer: str

    preferred_decision_id: uuid.UUID | None = None
    preference_reason: str | None = None

    similarities: list[ComparisonClaim] = Field(
        default_factory=list
    )

    differences: list[ComparisonClaim] = Field(
        default_factory=list
    )

    changed_reasons: list[ComparisonClaim] = Field(
        default_factory=list
    )

    changed_alternatives: list[ComparisonClaim] = Field(
        default_factory=list
    )

    changed_stakeholders: list[ComparisonClaim] = Field(
        default_factory=list
    )

    changed_risks: list[ComparisonClaim] = Field(
        default_factory=list
    )

    changed_impacts: list[ComparisonClaim] = Field(
        default_factory=list
    )

    conflicts: list[ComparisonClaim] = Field(
        default_factory=list
    )

    uncertainties: list[ComparisonClaim] = Field(
        default_factory=list
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    source_ids: list[str] = Field(
        default_factory=list
    )


class DecisionComparisonResponse(BaseModel):
    question: str

    decision_a: DecisionComparisonSnapshot
    decision_b: DecisionComparisonSnapshot

    result: DecisionComparisonResult
    citations: list[ReasoningCitation]

    model: str
    total_sources: int
    supported_claims: int
    unsupported_claims: int
    citation_coverage: float = Field(
        ge=0.0,
        le=1.0,
    )
