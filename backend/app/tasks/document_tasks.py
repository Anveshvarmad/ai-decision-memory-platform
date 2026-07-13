import uuid
from pathlib import Path

from celery.utils.log import get_task_logger
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.document import Document, DocumentChunk
from app.services.document_extractor import (
    DocumentExtractionError,
    extract_document,
)
from app.services.text_chunker import (
    chunk_text,
    estimate_token_count,
)
from app.worker import celery_app


logger = get_task_logger(__name__)
settings = get_settings()


def update_document_failure(
    document_id: uuid.UUID,
    error_message: str,
) -> None:
    with SessionLocal() as database:
        document = database.scalar(
            select(Document).where(
                Document.id == document_id
            )
        )

        if document is None:
            return

        document.status = "failed"
        document.processing_progress = 0
        document.error_message = error_message[:2000]

        database.commit()


@celery_app.task(
    bind=True,
    name="documents.process",
    autoretry_for=(),
)
def process_document(
    self,
    document_id: str,
) -> dict:
    parsed_document_id = uuid.UUID(document_id)

    try:
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

            document.status = "processing"
            document.processing_progress = 10
            document.error_message = None

            database.commit()

            file_path = Path(document.file_path)

            if not file_path.exists():
                raise FileNotFoundError(
                    f"Uploaded file does not exist: {file_path}"
                )

            segments = extract_document(file_path)

            document.processing_progress = 35
            database.commit()

            if not segments:
                raise DocumentExtractionError(
                    "No readable text was extracted from the document"
                )

            database.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.document_id == document.id
                )
            )

            chunk_index = 0
            total_characters = 0
            page_count = 0

            for segment in segments:
                text = segment["text"]
                total_characters += len(text)

                if segment["page_number"] is not None:
                    page_count = max(
                        page_count,
                        segment["page_number"],
                    )

                chunks = chunk_text(
                    text=text,
                    chunk_size=settings.chunk_size,
                    overlap=settings.chunk_overlap,
                )

                for chunk in chunks:
                    database.add(
                        DocumentChunk(
                            document_id=document.id,
                            chunk_index=chunk_index,
                            content=chunk,
                            token_count=estimate_token_count(chunk),
                            page_number=segment["page_number"],
                            section_title=segment["section_title"],
                            metadata_json={},
                            embedding=None,
                        )
                    )

                    chunk_index += 1

            if chunk_index == 0:
                raise DocumentExtractionError(
                    "The document did not produce any searchable chunks"
                )

            document.processing_progress = 85
            database.flush()

            document.status = "completed"
            document.processing_progress = 100
            document.error_message = None
            document.metadata_json = {
                **document.metadata_json,
                "chunk_count": chunk_index,
                "character_count": total_characters,
                "page_count": page_count or None,
                "celery_task_id": self.request.id,
            }

            database.commit()

            logger.info(
                "Processed document %s into %s chunks",
                document.id,
                chunk_index,
            )

            return {
                "document_id": str(document.id),
                "status": "completed",
                "chunk_count": chunk_index,
            }

    except Exception as error:
        logger.exception(
            "Document processing failed for %s",
            document_id,
        )

        update_document_failure(
            parsed_document_id,
            str(error),
        )

        raise
