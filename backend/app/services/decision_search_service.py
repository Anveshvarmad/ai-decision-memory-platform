import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.decision import Decision


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "did",
    "do",
    "does",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "the",
    "to",
    "was",
    "were",
    "what",
    "when",
    "which",
    "who",
    "why",
    "with",
}


@dataclass
class DecisionMatch:
    decision: Decision
    relevance_score: float


def tokenize(value: str) -> set[str]:
    words = re.findall(
        r"[a-zA-Z0-9_-]+",
        value.lower(),
    )

    return {
        word
        for word in words
        if len(word) > 1
        and word not in STOP_WORDS
    }


def decision_searchable_text(
    decision: Decision,
) -> str:
    values = [
        decision.title,
        decision.summary or "",
        decision.decision_statement,
        decision.reason or "",
        " ".join(
            str(item)
            for item in decision.alternatives
        ),
        " ".join(
            str(item)
            for item in decision.participants
        ),
        " ".join(
            str(item)
            for item in decision.related_entities
        ),
        decision.status,
    ]

    return " ".join(values)


def calculate_decision_relevance(
    query: str,
    decision: Decision,
) -> float:
    query_tokens = tokenize(query)

    if not query_tokens:
        return 0.0

    title_tokens = tokenize(decision.title)
    body_tokens = tokenize(
        decision_searchable_text(decision)
    )

    title_overlap = len(
        query_tokens & title_tokens
    )

    body_overlap = len(
        query_tokens & body_tokens
    )

    query_lower = query.lower()
    title_lower = decision.title.lower()

    phrase_bonus = (
        0.3
        if title_lower in query_lower
        or query_lower in title_lower
        else 0.0
    )

    score = (
        title_overlap * 0.25
        + body_overlap * 0.08
        + phrase_bonus
    )

    if decision.status == "approved":
        score += 0.05

    return round(
        min(score, 1.0),
        6,
    )


def find_relevant_decisions(
    database: Session,
    workspace_id: uuid.UUID,
    query: str,
    limit: int = 3,
) -> list[DecisionMatch]:
    decisions = list(
        database.scalars(
            select(Decision)
            .where(
                Decision.workspace_id
                == workspace_id
            )
            .order_by(
                Decision.confidence_score.desc(),
                Decision.created_at.desc(),
            )
        )
    )

    matches = [
        DecisionMatch(
            decision=decision,
            relevance_score=(
                calculate_decision_relevance(
                    query,
                    decision,
                )
            ),
        )
        for decision in decisions
    ]

    matches.sort(
        key=lambda match: (
            match.relevance_score,
            match.decision.confidence_score,
        ),
        reverse=True,
    )

    positive_matches = [
        match
        for match in matches
        if match.relevance_score > 0
    ]

    if positive_matches:
        return positive_matches[:limit]

    return matches[:1]
