from app.schemas.context import (
    RankedContextItem,
)
from app.services.context_ranker import (
    calculate_decision_score,
    deduplicate_candidates,
    estimate_tokens,
    normalize_text,
    select_with_token_budget,
    text_similarity,
)


def create_item(
    source_id: str,
    content: str,
    score: float,
    token_estimate: int,
    source_type: str = "document_chunk",
):
    return RankedContextItem(
        source_id=source_id,
        source_type=source_type,
        title=source_id,
        content=content,
        score=score,
        token_estimate=token_estimate,
        metadata={},
        score_components={},
    )


def test_normalize_text():
    assert (
        normalize_text(
            "  PostgreSQL,   Migration! "
        )
        == "postgresql migration"
    )


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcdefgh") == 2


def test_identical_text_similarity():
    assert (
        text_similarity(
            "MongoDB migration",
            "MongoDB migration",
        )
        == 1.0
    )


def test_approved_decision_scores_above_rejected():
    approved_score, _ = (
        calculate_decision_score(
            relevance_score=0.8,
            confidence_score=0.9,
            status="approved",
            evidence_count=2,
            timeline_count=2,
            graph_count=2,
        )
    )

    rejected_score, _ = (
        calculate_decision_score(
            relevance_score=0.8,
            confidence_score=0.9,
            status="rejected",
            evidence_count=2,
            timeline_count=2,
            graph_count=2,
        )
    )

    assert approved_score > rejected_score


def test_deduplication_removes_duplicate_content():
    candidates = [
        create_item(
            "a",
            "PostgreSQL was selected.",
            0.9,
            10,
        ),
        create_item(
            "b",
            "PostgreSQL was selected.",
            0.8,
            10,
        ),
    ]

    selected, removed = (
        deduplicate_candidates(
            candidates,
            threshold=0.9,
        )
    )

    assert len(selected) == 1
    assert removed == 1
    assert selected[0].source_id == "a"


def test_token_budget_is_respected():
    candidates = [
        create_item("a", "A", 0.9, 80),
        create_item("b", "B", 0.8, 50),
        create_item("c", "C", 0.7, 20),
    ]

    selected, used_tokens = (
        select_with_token_budget(
            candidates=candidates,
            token_budget=100,
            maximum_items=10,
        )
    )

    assert used_tokens <= 100
    assert len(selected) >= 1
