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
    DocumentProcessingEvent,
)


TERMINAL_STATUSES = {
    "completed",
    "failed",
    "error",
    "cancelled",
}


def normalize_progress(value) -> int:
    try:
        progress = int(value or 0)
    except (TypeError, ValueError):
        return 0

    return min(max(progress, 0), 100)


def determine_stage(
    status: str,
    progress: int,
) -> str:
    normalized = status.lower()

    stage_map = {
        "pending": "queued",
        "queued": "queued",
        "processing": "extracting",
        "extracting": "extracting",
        "chunking": "chunking",
        "embedding": "embedding",
        "indexing": "indexing",
        "detecting_decisions": (
            "detecting_decisions"
        ),
        "building_graph": "building_graph",
        "building_timeline": (
            "building_timeline"
        ),
        "completed": "completed",
        "failed": "failed",
        "error": "failed",
        "cancelled": "cancelled",
    }

    if normalized in stage_map:
        return stage_map[normalized]

    if progress < 10:
        return "queued"

    if progress < 35:
        return "extracting"

    if progress < 55:
        return "chunking"

    if progress < 80:
        return "embedding"

    if progress < 100:
        return "finalizing"

    return "completed"


def stage_message(
    stage: str,
    filename: str,
) -> str:
    messages = {
        "queued": (
            f"{filename} is waiting to be processed."
        ),
        "extracting": (
            f"Extracting text from {filename}."
        ),
        "chunking": (
            "Splitting document content into "
            "retrievable chunks."
        ),
        "embedding": (
            "Generating semantic embeddings."
        ),
        "indexing": (
            "Writing vectors and search indexes."
        ),
        "detecting_decisions": (
            "Detecting organizational decisions."
        ),
        "building_graph": (
            "Building knowledge graph entities."
        ),
        "building_timeline": (
            "Extracting decision timeline events."
        ),
        "finalizing": (
            "Finalizing document intelligence."
        ),
        "completed": (
            f"{filename} is ready."
        ),
        "failed": (
            f"Processing failed for {filename}."
        ),
        "cancelled": (
            f"Processing was cancelled for "
            f"{filename}."
        ),
    }

    return messages.get(
        stage,
        f"Processing {filename}.",
    )


def load_document_snapshot(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> DocumentProcessingEvent | None:
    database: Session = SessionLocal()

    try:
        document = database.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.workspace_id
                == workspace_id,
            )
        )

        if document is None:
            return None

        status = str(
            getattr(
                document,
                "status",
                "pending",
            )
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

        error_message = getattr(
            document,
            "error_message",
            None,
        )

        chunk_count = getattr(
            document,
            "chunk_count",
            None,
        )

        terminal = (
            status.lower()
            in TERMINAL_STATUSES
            or progress >= 100
        )

        return DocumentProcessingEvent(
            event_type=(
                "document.processing.updated"
            ),
            document_id=document.id,
            workspace_id=document.workspace_id,
            status=status,
            progress=progress,
            stage=stage,
            message=stage_message(
                stage,
                filename,
            ),
            chunk_count=chunk_count,
            error_message=error_message,
            terminal=terminal,
            timestamp=datetime.now(UTC),
        )
    finally:
        database.close()


def format_sse(
    event: DocumentProcessingEvent,
) -> str:
    payload = event.model_dump(
        mode="json"
    )

    return (
        f"event: {event.event_type}\n"
        f"data: {json.dumps(payload)}\n\n"
    )


async def stream_document_processing(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID,
    poll_interval_seconds: float = 1.0,
    heartbeat_seconds: float = 15.0,
) -> AsyncIterator[str]:
    previous_signature: tuple | None = None
    heartbeat_elapsed = 0.0

    while True:
        event = await asyncio.to_thread(
            load_document_snapshot,
            document_id,
            workspace_id,
        )

        if event is None:
            yield (
                "event: document.not_found\n"
                'data: {"message": '
                '"Document not found"}\n\n'
            )
            return

        signature = (
            event.status,
            event.progress,
            event.stage,
            event.error_message,
            event.chunk_count,
        )

        if signature != previous_signature:
            yield format_sse(event)
            previous_signature = signature
            heartbeat_elapsed = 0.0

        if event.terminal:
            return

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
