import asyncio
import json
import uuid
from datetime import UTC, datetime
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.document import Document
from app.schemas.processing import (
    WorkspaceProcessingDocument,
    WorkspaceProcessingEvent,
)
from app.services.document_stream_service import (
    TERMINAL_STATUSES,
    determine_stage,
    normalize_progress,
    stage_message,
)


ACTIVE_STATUSES = {
    "pending",
    "queued",
    "processing",
    "extracting",
    "chunking",
    "embedding",
    "indexing",
    "detecting_decisions",
    "building_graph",
    "building_timeline",
    "finalizing",
}

FAILED_STATUSES = {
    "failed",
    "error",
    "cancelled",
}


def document_to_processing_item(
    document: Document,
) -> WorkspaceProcessingDocument:
    status = str(
        getattr(document, "status", "pending")
        or "pending"
    )

    progress = normalize_progress(
        getattr(
            document,
            "processing_progress",
            0,
        )
    )

    stage = determine_stage(
        status=status,
        progress=progress,
    )

    filename = str(
        getattr(
            document,
            "original_filename",
            "document",
        )
    )

    return WorkspaceProcessingDocument(
        document_id=document.id,
        workspace_id=document.workspace_id,
        filename=filename,
        status=status,
        progress=progress,
        stage=stage,
        message=stage_message(
            stage,
            filename,
        ),
        chunk_count=getattr(
            document,
            "chunk_count",
            None,
        ),
        error_message=getattr(
            document,
            "error_message",
            None,
        ),
        terminal=(
            status.lower() in TERMINAL_STATUSES
            or progress >= 100
        ),
        created_at=getattr(
            document,
            "created_at",
            None,
        ),
        updated_at=getattr(
            document,
            "updated_at",
            None,
        ),
    )


def load_workspace_processing_snapshot(
    workspace_id: uuid.UUID,
    recent_limit: int = 12,
) -> WorkspaceProcessingEvent:
    database: Session = SessionLocal()

    try:
        documents = list(
            database.scalars(
                select(Document)
                .where(
                    Document.workspace_id
                    == workspace_id
                )
                .order_by(
                    Document.updated_at.desc()
                )
            )
        )

        items = [
            document_to_processing_item(
                document
            )
            for document in documents
        ]

        active_documents = [
            item
            for item in items
            if (
                item.status.lower()
                in ACTIVE_STATUSES
                and not item.terminal
            )
        ]

        terminal_documents = [
            item
            for item in items
            if item.terminal
        ][:recent_limit]

        completed_count = sum(
            1
            for item in terminal_documents
            if item.status.lower()
            == "completed"
        )

        failed_count = sum(
            1
            for item in terminal_documents
            if item.status.lower()
            in FAILED_STATUSES
        )

        return WorkspaceProcessingEvent(
            workspace_id=workspace_id,
            active_documents=active_documents,
            recent_documents=(
                terminal_documents
            ),
            active_count=len(
                active_documents
            ),
            completed_count=(
                completed_count
            ),
            failed_count=failed_count,
            timestamp=datetime.now(UTC),
        )
    finally:
        database.close()


def snapshot_signature(
    event: WorkspaceProcessingEvent,
) -> tuple:
    def item_signature(
        item: WorkspaceProcessingDocument,
    ) -> tuple:
        return (
            str(item.document_id),
            item.status,
            item.progress,
            item.stage,
            item.chunk_count,
            item.error_message,
        )

    return (
        tuple(
            item_signature(item)
            for item
            in event.active_documents
        ),
        tuple(
            item_signature(item)
            for item
            in event.recent_documents
        ),
    )


def format_workspace_sse(
    event: WorkspaceProcessingEvent,
) -> str:
    payload = event.model_dump(
        mode="json"
    )

    return (
        "event: workspace.processing.snapshot\n"
        f"data: {json.dumps(payload)}\n\n"
    )


async def stream_workspace_processing(
    workspace_id: uuid.UUID,
    poll_interval_seconds: float = 1.0,
    heartbeat_seconds: float = 15.0,
) -> AsyncIterator[str]:
    previous_signature: tuple | None = None
    heartbeat_elapsed = 0.0

    while True:
        event = await asyncio.to_thread(
            load_workspace_processing_snapshot,
            workspace_id,
        )

        signature = snapshot_signature(event)

        if signature != previous_signature:
            yield format_workspace_sse(
                event
            )

            previous_signature = signature
            heartbeat_elapsed = 0.0

        await asyncio.sleep(
            poll_interval_seconds
        )

        heartbeat_elapsed += (
            poll_interval_seconds
        )

        if (
            heartbeat_elapsed
            >= heartbeat_seconds
        ):
            yield (
                "event: heartbeat\n"
                "data: {}\n\n"
            )

            heartbeat_elapsed = 0.0
