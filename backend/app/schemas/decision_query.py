import uuid

from pydantic import BaseModel


class DecisionQueryClassification(BaseModel):
    query_type: str
    confidence: float
    matched_terms: list[str]


class RelatedDecisionResponse(BaseModel):
    decision_id: uuid.UUID
    title: str
    status: str
    confidence_score: float
    relevance_score: float


class DecisionAwareChatMetadata(BaseModel):
    query_type: str
    matched_decisions: list[RelatedDecisionResponse]
    timeline_event_count: int
    graph_node_count: int
    document_result_count: int
