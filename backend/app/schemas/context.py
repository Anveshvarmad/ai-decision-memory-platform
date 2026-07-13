import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ContextQueryRequest(BaseModel):
    query: str = Field(
        min_length=2,
        max_length=2000,
    )

    decision_limit: int = Field(
        default=3,
        ge=1,
        le=10,
    )

    document_limit: int = Field(
        default=8,
        ge=1,
        le=20,
    )

    timeline_limit: int = Field(
        default=20,
        ge=1,
        le=100,
    )

    graph_neighbor_limit: int = Field(
        default=25,
        ge=1,
        le=100,
    )

    minimum_similarity: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
    )


class AggregatedDecisionEvidence(BaseModel):
    evidence_id: uuid.UUID
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    content: str
    page_number: int | None
    section_title: str | None
    evidence_type: str | None
    relevance_score: float
    explanation: str | None


class AggregatedTimelineEvent(BaseModel):
    event_id: uuid.UUID
    event_type: str
    title: str
    description: str | None
    event_date: datetime | None
    source_reference: dict[str, Any]


class AggregatedGraphRelationship(BaseModel):
    relationship_id: uuid.UUID
    source_entity_id: uuid.UUID
    source_name: str
    source_type: str
    relationship_type: str
    target_entity_id: uuid.UUID
    target_name: str
    target_type: str
    description: str | None


class AggregatedDecisionContext(BaseModel):
    decision_id: uuid.UUID
    title: str
    summary: str | None
    decision_statement: str
    reason: str | None
    alternatives: list[Any]
    participants: list[Any]
    related_entities: list[Any]
    status: str
    confidence_score: float
    decision_date: datetime | None
    relevance_score: float

    evidence: list[AggregatedDecisionEvidence]
    timeline: list[AggregatedTimelineEvent]
    graph_relationships: list[
        AggregatedGraphRelationship
    ]


class AggregatedDocumentContext(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    source_type: str
    chunk_index: int
    content: str
    page_number: int | None
    section_title: str | None

    semantic_rank: int | None
    semantic_similarity: float | None
    keyword_rank: int | None
    keyword_score: float | None
    exact_match: bool
    fused_score: float
    matched_by: list[str]


class ContextSourceCounts(BaseModel):
    decisions: int
    decision_evidence: int
    timeline_events: int
    graph_relationships: int
    document_chunks: int


class AggregatedContextResponse(BaseModel):
    query: str
    query_type: str
    classification_confidence: float
    matched_terms: list[str]

    decisions: list[AggregatedDecisionContext]
    documents: list[AggregatedDocumentContext]

    source_counts: ContextSourceCounts
    evidence_found: bool


class RankedContextItem(BaseModel):
    source_id: str
    source_type: str
    title: str
    content: str

    score: float
    token_estimate: int

    decision_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None

    metadata: dict[str, Any] = Field(
        default_factory=dict
    )

    score_components: dict[str, float] = Field(
        default_factory=dict
    )


class ContextRankingRequest(ContextQueryRequest):
    token_budget: int = Field(
        default=6000,
        ge=500,
        le=30000,
    )

    maximum_items: int = Field(
        default=30,
        ge=1,
        le=100,
    )

    deduplication_threshold: float = Field(
        default=0.88,
        ge=0.5,
        le=1.0,
    )


class RankedContextResponse(BaseModel):
    query: str
    query_type: str
    classification_confidence: float

    ranked_items: list[RankedContextItem]

    total_candidates: int
    selected_items: int
    estimated_tokens: int
    token_budget: int
    removed_duplicates: int

    source_counts: ContextSourceCounts
    evidence_found: bool


class ReasoningCitation(BaseModel):
    citation_number: int
    source_id: str
    source_type: str
    title: str

    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None
    decision_id: uuid.UUID | None = None

    document_name: str | None = None
    page_number: int | None = None
    section_title: str | None = None

    excerpt: str
    score: float


class ReasoningTimelineItem(BaseModel):
    date: str | None
    title: str
    description: str | None
    source_ids: list[str] = Field(
        default_factory=list
    )


class RelatedDecisionItem(BaseModel):
    decision_id: uuid.UUID | None = None
    title: str
    relationship: str | None = None
    status: str | None = None
    source_ids: list[str] = Field(
        default_factory=list
    )


class DecisionReasoningResult(BaseModel):
    answer: str
    summary: str

    decision_title: str | None = None
    decision_status: str | None = None
    decision_date: str | None = None

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    reasons: list[str] = Field(
        default_factory=list
    )

    alternatives: list[str] = Field(
        default_factory=list
    )

    stakeholders: list[str] = Field(
        default_factory=list
    )

    risks: list[str] = Field(
        default_factory=list
    )

    impacts: list[str] = Field(
        default_factory=list
    )

    timeline: list[ReasoningTimelineItem] = Field(
        default_factory=list
    )

    related_decisions: list[
        RelatedDecisionItem
    ] = Field(
        default_factory=list
    )

    uncertainties: list[str] = Field(
        default_factory=list
    )

    source_ids: list[str] = Field(
        default_factory=list
    )


class DecisionReasoningRequest(
    ContextRankingRequest
):
    include_raw_context: bool = False


class DecisionReasoningResponse(BaseModel):
    query: str
    query_type: str

    result: DecisionReasoningResult
    citations: list[ReasoningCitation]

    selected_context_items: int
    estimated_context_tokens: int
    model: str

    raw_context: list[
        RankedContextItem
    ] | None = None
