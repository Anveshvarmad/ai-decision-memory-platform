from app.schemas.comparison import (
    ComparisonClaim,
    DecisionComparisonResult,
)
from app.services.decision_comparison_service import (
    calculate_coverage,
    normalize_claims,
)


def test_normalize_claims_filters_sources():
    claims = normalize_claims(
        [
            {
                "text": "Both use PostgreSQL.",
                "source_ids": [
                    "source-a",
                    "invented",
                ],
            }
        ],
        {"source-a"},
    )

    assert len(claims) == 1
    assert claims[0].source_ids == [
        "source-a"
    ]
    assert claims[0].supported is True


def test_calculate_coverage():
    result = DecisionComparisonResult(
        executive_summary="Comparison",
        comparison_answer="Answer",
        similarities=[
            ComparisonClaim(
                text="Supported",
                source_ids=["source-a"],
                supported=True,
            )
        ],
        differences=[
            ComparisonClaim(
                text="Unsupported",
                source_ids=[],
                supported=False,
            )
        ],
        confidence=0.8,
    )

    supported, unsupported, coverage = (
        calculate_coverage(result)
    )

    assert supported == 1
    assert unsupported == 1
    assert coverage == 0.5
