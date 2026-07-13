from app.schemas.context import (
    RankedContextItem,
)
from app.services.decision_intelligence_service import (
    build_reasoning_citations,
)


def test_build_reasoning_citations():
    item = RankedContextItem(
        source_id="document-test",
        source_type="document_chunk",
        title="Document evidence",
        content="PostgreSQL was approved.",
        score=0.85,
        token_estimate=12,
        metadata={
            "document_name": "decision.md",
            "page_number": 2,
            "section_title": "Approval",
        },
        score_components={},
    )

    citations = build_reasoning_citations(
        ranked_items=[item],
        used_source_ids=[
            "document-test"
        ],
    )

    assert len(citations) == 1
    assert (
        citations[0].document_name
        == "decision.md"
    )
    assert citations[0].page_number == 2
