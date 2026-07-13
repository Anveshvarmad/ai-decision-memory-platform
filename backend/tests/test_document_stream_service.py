import uuid

from app.schemas.processing import (
    DocumentProcessingEvent,
)
from app.services.document_stream_service import (
    determine_stage,
    format_sse,
    normalize_progress,
)


def test_normalize_progress():
    assert normalize_progress(-10) == 0
    assert normalize_progress(55) == 55
    assert normalize_progress(140) == 100
    assert normalize_progress(None) == 0


def test_determine_known_stage():
    assert (
        determine_stage(
            "embedding",
            60,
        )
        == "embedding"
    )


def test_determine_stage_from_progress():
    assert (
        determine_stage(
            "unknown",
            20,
        )
        == "extracting"
    )

    assert (
        determine_stage(
            "unknown",
            70,
        )
        == "embedding"
    )


def test_format_sse():
    event = DocumentProcessingEvent(
        event_type=(
            "document.processing.updated"
        ),
        document_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        status="processing",
        progress=30,
        stage="extracting",
        message="Extracting text.",
        terminal=False,
        timestamp="2026-07-13T12:00:00Z",
    )

    payload = format_sse(event)

    assert payload.startswith(
        "event: document.processing.updated"
    )

    assert '"progress": 30' in payload
    assert payload.endswith("\n\n")
