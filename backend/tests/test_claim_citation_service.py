from app.schemas.context import (
    DecisionReasoningResult,
    RankedContextItem,
    ReasoningClaim,
)
from app.services.claim_citation_service import (
    build_claim_citation_groups,
)


def test_claim_citation_coverage():
    source = RankedContextItem(
        source_id="source-1",
        source_type="document_chunk",
        title="Migration document",
        content="PostgreSQL improved consistency.",
        score=0.9,
        token_estimate=10,
        metadata={
            "document_name": "migration.md",
        },
        score_components={},
    )

    result = DecisionReasoningResult(
        answer="PostgreSQL was selected.",
        summary="Migration decision.",
        confidence=0.9,
        reasons=[],
        reason_claims=[
            ReasoningClaim(
                text=(
                    "PostgreSQL improved "
                    "transactional consistency."
                ),
                source_ids=["source-1"],
                supported=True,
            )
        ],
        risks=[],
        risk_claims=[
            ReasoningClaim(
                text="Migration downtime",
                source_ids=[],
                supported=False,
            )
        ],
    )

    groups, coverage = (
        build_claim_citation_groups(
            result=result,
            ranked_items=[source],
        )
    )

    assert len(groups) == 2
    assert coverage.total_claims == 2
    assert coverage.supported_claims == 1
    assert coverage.unsupported_claims == 1
    assert coverage.coverage_ratio == 0.5
