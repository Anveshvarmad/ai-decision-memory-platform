import uuid

from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.decision import Decision, DecisionEvidence
from app.models.document import Document, DocumentChunk
from app.services.decision_extraction_service import (
    extract_decisions_from_chunks,
)
from app.worker import celery_app


logger = get_task_logger(__name__)


def normalize_title(value: str) -> str:
    return " ".join(value.lower().split())


@celery_app.task(
    bind=True,
    name="decisions.extract",
)
def extract_document_decisions(
    self,
    document_id: str,
) -> dict:
    parsed_document_id = uuid.UUID(document_id)

    with SessionLocal() as database:
        document = database.scalar(
            select(Document).where(
                Document.id == parsed_document_id
            )
        )

        if document is None:
            raise ValueError(
                f"Document {document_id} was not found"
            )

        if document.status != "completed":
            raise ValueError(
                "Document must finish processing before "
                "decision extraction"
            )

        chunks = list(
            database.scalars(
                select(DocumentChunk)
                .where(
                    DocumentChunk.document_id == document.id
                )
                .order_by(DocumentChunk.chunk_index)
            )
        )

        if not chunks:
            raise ValueError(
                "Document contains no searchable chunks"
            )

        chunk_payload = [
            {
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
            }
            for chunk in chunks
        ]

        extracted_decisions = extract_decisions_from_chunks(
            chunk_payload
        )

        chunk_by_index = {
            chunk.chunk_index: chunk
            for chunk in chunks
        }

        created_decisions = 0
        skipped_decisions = 0

        for extracted in extracted_decisions:
            normalized_title = normalize_title(
                extracted.title
            )

            existing_decisions = list(
                database.scalars(
                    select(Decision).where(
                        Decision.workspace_id
                        == document.workspace_id
                    )
                )
            )

            existing = next(
                (
                    item
                    for item in existing_decisions
                    if normalize_title(item.title)
                    == normalized_title
                ),
                None,
            )

            if existing is not None:
                skipped_decisions += 1
                continue

            decision = Decision(
                workspace_id=document.workspace_id,
                title=extracted.title.strip(),
                summary=extracted.summary,
                decision_statement=(
                    extracted.decision_statement.strip()
                ),
                reason=extracted.reason,
                alternatives=extracted.alternatives,
                participants=extracted.participants,
                related_entities=extracted.related_entities,
                status="candidate",
                confidence_score=extracted.confidence_score,
                decision_date=extracted.decision_date,
            )

            database.add(decision)
            database.flush()

            evidence_count = 0

            for extracted_evidence in extracted.evidence:
                chunk = chunk_by_index.get(
                    extracted_evidence.chunk_index
                )

                if chunk is None:
                    continue

                evidence = DecisionEvidence(
                    decision_id=decision.id,
                    chunk_id=chunk.id,
                    evidence_type=(
                        extracted_evidence.evidence_type
                    ),
                    relevance_score=(
                        extracted_evidence.relevance_score
                    ),
                    explanation=(
                        extracted_evidence.explanation
                    ),
                )

                database.add(evidence)
                evidence_count += 1

            if evidence_count == 0:
                database.delete(decision)
                skipped_decisions += 1
                continue

            created_decisions += 1

        document.metadata_json = {
            **document.metadata_json,
            "decision_extraction_task_id": self.request.id,
            "decision_extraction_status": "completed",
            "extracted_decision_count": created_decisions,
            "skipped_decision_count": skipped_decisions,
        }

        database.commit()

        logger.info(
            "Extracted %s decisions from document %s",
            created_decisions,
            document.id,
        )

        return {
            "document_id": str(document.id),
            "created_decisions": created_decisions,
            "skipped_decisions": skipped_decisions,
            "status": "completed",
        }
