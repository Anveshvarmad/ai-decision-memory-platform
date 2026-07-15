from app.services.decision_health_service import (
    calculate_health_score,
    grade_for_score,
)


def test_empty_workspace_score():
    assert calculate_health_score(
        total=0,
        stale=0,
        missing_evidence=0,
        conflicts=0,
        reversed_count=0,
        frequent_reversals=0,
    ) == 100


def test_risk_reduces_score():
    score = calculate_health_score(
        total=10,
        stale=2,
        missing_evidence=3,
        conflicts=1,
        reversed_count=1,
        frequent_reversals=1,
    )

    assert 0 <= score < 100


def test_score_is_bounded():
    score = calculate_health_score(
        total=1,
        stale=100,
        missing_evidence=100,
        conflicts=100,
        reversed_count=100,
        frequent_reversals=100,
    )

    assert score == 0


def test_grade_boundaries():
    assert grade_for_score(95) == "A"
    assert grade_for_score(85) == "B"
    assert grade_for_score(75) == "C"
    assert grade_for_score(65) == "D"
    assert grade_for_score(40) == "F"
