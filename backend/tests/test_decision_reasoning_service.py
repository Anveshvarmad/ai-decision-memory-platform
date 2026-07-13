from app.schemas.context import (
    RankedContextItem,
)
from app.services.decision_reasoning_service import (
    extract_json_object,
    normalize_confidence,
    normalize_string_list,
    parse_reasoning_result,
    remove_code_fences,
)


def create_ranked_item():
    return RankedContextItem(
        source_id="decision-test",
        source_type="decision",
        title="PostgreSQL migration",
        content="PostgreSQL was approved.",
        score=0.9,
        token_estimate=10,
        metadata={},
        score_components={},
    )


def test_remove_json_code_fence():
    value = """```json
{"answer": "test"}
```"""

    assert remove_code_fences(value) == (
        '{"answer": "test"}'
    )


def test_extract_json_object():
    payload = extract_json_object(
        '{"answer": "test"}'
    )

    assert payload["answer"] == "test"


def test_normalize_confidence():
    assert normalize_confidence(1.5) == 1.0
    assert normalize_confidence(-1) == 0.0
    assert normalize_confidence("0.8") == 0.8


def test_normalize_string_list():
    assert normalize_string_list(
        [" Alice ", "", 4]
    ) == ["Alice"]


def test_parse_reasoning_result_filters_invalid_sources():
    payload = {
        "answer": "PostgreSQL was selected.",
        "summary": "Database decision.",
        "confidence": 0.9,
        "reasons": [
            {
                "text": (
                    "Transactional consistency"
                ),
                "source_ids": [
                    "decision-test"
                ],
            }
        ],
        "alternatives": [],
        "stakeholders": [
            {
                "text": "Alice",
                "source_ids": [
                    "decision-test"
                ],
            }
        ],
        "risks": [],
        "impacts": [],
        "timeline": [],
        "related_decisions": [],
        "uncertainties": [],
        "source_ids": [
            "decision-test",
            "invented-source",
        ],
    }

    result = parse_reasoning_result(
        payload=payload,
        ranked_items=[
            create_ranked_item()
        ],
    )

    assert result.source_ids == [
        "decision-test"
    ]
