from app.services.context_aggregator import (
    AggregatorLimits,
    safe_list,
)


def test_safe_list_with_list():
    assert safe_list(["a", "b"]) == [
        "a",
        "b",
    ]


def test_safe_list_with_none():
    assert safe_list(None) == []


def test_safe_list_with_scalar():
    assert safe_list("PostgreSQL") == [
        "PostgreSQL"
    ]


def test_default_aggregator_limits():
    limits = AggregatorLimits()

    assert limits.decision_limit == 3
    assert limits.document_limit == 8
    assert limits.timeline_limit == 20
    assert limits.graph_neighbor_limit == 25
