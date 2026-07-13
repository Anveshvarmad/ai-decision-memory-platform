import uuid

from app.schemas.processing import (
    WorkspaceProcessingDocument,
    WorkspaceProcessingEvent,
)
from app.services.workspace_processing_stream_service import (
    format_workspace_sse,
    snapshot_signature,
)


def build_item(
    progress: int,
) -> WorkspaceProcessingDocument:
    return WorkspaceProcessingDocument(
        document_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        filename="decision.pdf",
        status="processing",
        progress=progress,
        stage="extracting",
        message="Extracting.",
        terminal=False,
    )


def test_snapshot_signature_changes():
    workspace_id = uuid.uuid4()

    first = WorkspaceProcessingEvent(
        workspace_id=workspace_id,
        active_documents=[
            build_item(20)
        ],
        timestamp=(
            "2026-07-13T12:00:00Z"
        ),
    )

    second = WorkspaceProcessingEvent(
        workspace_id=workspace_id,
        active_documents=[
            build_item(40)
        ],
        timestamp=(
            "2026-07-13T12:00:01Z"
        ),
    )

    assert (
        snapshot_signature(first)
        != snapshot_signature(second)
    )


def test_format_workspace_sse():
    event = WorkspaceProcessingEvent(
        workspace_id=uuid.uuid4(),
        timestamp=(
            "2026-07-13T12:00:00Z"
        ),
    )

    payload = format_workspace_sse(
        event
    )

    assert payload.startswith(
        "event: workspace.processing.snapshot"
    )

    assert payload.endswith("\n\n")
