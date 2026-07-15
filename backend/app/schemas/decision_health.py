from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DecisionHealthCounts(BaseModel):
    stale: int = 0
    missing_evidence: int = 0
    conflicts: int = 0
    reversed: int = 0
    frequent_reversals: int = 0


class DecisionHealthIssue(BaseModel):
    decision_id: str
    title: str
    issue_type: Literal[
        "stale",
        "missing_evidence",
        "conflict",
        "reversed",
        "frequent_reversal",
    ]
    severity: Literal[
        "low",
        "medium",
        "high",
        "critical",
    ]
    summary: str
    status: str
    age_days: int | None = None
    evidence_count: int = 0
    updated_at: datetime | None = None


class DecisionHealthResponse(BaseModel):
    workspace_id: str
    generated_at: datetime
    stale_after_days: int = Field(ge=1, le=3650)
    health_score: int = Field(ge=0, le=100)
    grade: Literal["A", "B", "C", "D", "F"]
    total_decisions: int
    healthy_decisions: int
    decisions_needing_review: int
    counts: DecisionHealthCounts
    issues: list[DecisionHealthIssue]
    recommendations: list[str]
