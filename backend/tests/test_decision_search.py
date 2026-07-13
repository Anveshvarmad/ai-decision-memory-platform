from types import SimpleNamespace

from app.services.decision_search_service import (
    calculate_decision_relevance,
    tokenize,
)


def create_decision():
    return SimpleNamespace(
        title=(
            "Migrate order-management service "
            "from MongoDB to PostgreSQL"
        ),
        summary=(
            "Move the transactional database "
            "to PostgreSQL."
        ),
        decision_statement=(
            "The team approved PostgreSQL."
        ),
        reason=(
            "Improve reporting performance and "
            "transactional consistency."
        ),
        alternatives=[
            "MongoDB",
            "MySQL",
        ],
        participants=[
            "Alice",
            "Bob",
        ],
        related_entities=[
            "order-management service",
            "March 4 incident",
        ],
        status="approved",
    )


def test_tokenize_removes_stop_words():
    tokens = tokenize(
        "Why did the team move to PostgreSQL?"
    )

    assert "why" not in tokens
    assert "postgresql" in tokens


def test_relevance_for_matching_query():
    decision = create_decision()

    score = calculate_decision_relevance(
        "Why did the order-management service move to PostgreSQL?",
        decision,
    )

    assert score > 0


def test_lower_relevance_for_unrelated_query():
    decision = create_decision()

    score = calculate_decision_relevance(
        "What is the vacation policy?",
        decision,
    )

    assert score == 0
