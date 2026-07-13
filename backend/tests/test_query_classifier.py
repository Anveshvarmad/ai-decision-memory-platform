import pytest

from app.services.query_classifier import (
    classify_decision_query,
)


@pytest.mark.parametrize(
    ("question", "expected_type"),
    [
        (
            "Why did we move from MongoDB to PostgreSQL?",
            "why",
        ),
        (
            "Who approved the migration?",
            "who",
        ),
        (
            "When did the incident happen?",
            "when",
        ),
        (
            "Which alternatives were considered?",
            "alternatives",
        ),
        (
            "What is the current decision status?",
            "status",
        ),
        (
            "What systems were affected?",
            "impact",
        ),
        (
            "Which services are connected to this decision?",
            "relationship",
        ),
        (
            "Does this conflict with another decision?",
            "conflict",
        ),
    ],
)
def test_classifies_decision_questions(
    question,
    expected_type,
):
    result = classify_decision_query(question)

    assert result.query_type == expected_type
    assert result.confidence > 0.5


def test_general_question_classification():
    result = classify_decision_query(
        "Tell me about the database migration."
    )

    assert result.query_type == "general"
