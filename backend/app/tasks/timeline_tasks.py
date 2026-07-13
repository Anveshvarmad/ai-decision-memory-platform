import uuid

from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.decision import (
    Decision,
    DecisionEvent,
    DecisionEvidence,
)
from app.models.document import Document, DocumentChunk
from app.services.timeline_extraction_service import (
    extract_timeline_events,
)
from app.worker import celery_app


logger = get_task_logger(__name__)


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


@celery_app.task(
    bind=True,
    name="timelines.generate",
)
def generate_decision_timeline(
    self,
    decision_id: str,
) -> dict:
    parsed_decision_id = uuid.UUID(decision_id)

    with SessionLocal() as database:
        decision = database.scalar(
            select(Decision).where(
                Decision.id == parsed_decision_id
            )
        )

        if decision is None:
            raise ValueError(
                f"Decision {decision_id} was not found"
            )

        evidence_rows = database.execute(
            select(
                DocumentChunk,
                Document,
            )
            .join(
                DecisionEvidence,
                DecisionEvidence.chunk_id == DocumentChunk.id,
            )
            .join(
                Document,
                Document.id == DocumentChunk.document_id,
            )
            .where(
                DecisionEvidence.decision_id == decision.id
            )
            .order_by(DocumentChunk.chunk_index)
        ).all()

        if not evidence_rows:
            raise ValueError(
                "Decision contains no linked evidence"
            )

        chunks = [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(document.id),
                "document_name": document.original_filename,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
            }
            for chunk, document in evidence_rows
        ]

        extracted_events = extract_timeline_events(
            decision_title=decision.title,
            decision_statement=decision.decision_statement,
            decision_reason=decision.reason,
            chunks=chunks,
        )

        existing_events = list(
            database.scalars(
                select(DecisionEvent).where(
                    DecisionEvent.decision_id == decision.id
                )
            )
        )

        valid_chunk_indexes = {
            chunk["chunk_index"]
            for chunk in chunks
        }

        chunk_lookup = {
            chunk["chunk_index"]: chunk
            for chunk in chunks
        }

        created_count = 0
        skipped_count = 0

        for extracted in extracted_events:
            duplicate = next(
                (
                    event
                    for event in existing_events
                    if normalize_text(event.title)
                    == normalize_text(extracted.title)
                    and event.event_type == extracted.event_type
                ),
                None,
            )

            if duplicate is not None:
                skipped_count += 1
                continue

            source_chunks = []

            for chunk_index in extracted.chunk_indexes:
                if chunk_index not in valid_chunk_indexes:
                    continue

                chunk = chunk_lookup[chunk_index]

                source_chunks.append(
                    {
                        "chunk_id": chunk["chunk_id"],
                        "document_id": chunk["document_id"],
                        "document_name": chunk["document_name"],
                        "chunk_index": chunk["chunk_index"],
                        "page_number": chunk["page_number"],
                    }
                )

            if not source_chunks:
                skipped_count += 1
                continue

            event = DecisionEvent(
                decision_id=decision.id,
                event_type=extracted.event_type,
                title=extracted.title.strip(),
                description=extracted.description,
                event_date=extracted.event_date,
                source_reference={
                    "chunks": source_chunks,
                    "confidence_score": (
                        extracted.confidence_score
                    ),
                    "generation_task_id": self.request.id,
                },
            )

            database.add(event)
            existing_events.append(event)
            created_count += 1

        database.commit()

        logger.info(
            "Generated %s timeline events for decision %s",
            created_count,
            decision.id,
        )

        return {
            "decision_id": str(decision.id),
            "created_events": created_count,
            "skipped_events": skipped_count,
            "status": "completed",
        }
