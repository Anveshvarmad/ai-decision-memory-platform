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
from app.services.embedding_service import generate_embeddings
from app.services.text_chunker import (
    chunk_text,
    estimate_token_count,
)
from app.worker import celery_app


logger = get_task_logger(__name__)
settings = get_settings()

EMBEDDING_BATCH_SIZE = 16


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

            document.processing_progress = 30
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

            chunk_models: list[DocumentChunk] = []
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
                    chunk_model = DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk_index,
                        content=chunk,
                        token_count=estimate_token_count(chunk),
                        page_number=segment["page_number"],
                        section_title=segment["section_title"],
                        metadata_json={},
                        embedding=None,
                    )

                    database.add(chunk_model)
                    chunk_models.append(chunk_model)
                    chunk_index += 1

            if not chunk_models:
                raise DocumentExtractionError(
                    "The document did not produce searchable chunks"
                )

            database.flush()

            document.status = "embedding"
            document.processing_progress = 50
            database.commit()

            total_chunks = len(chunk_models)

            for batch_start in range(
                0,
                total_chunks,
                EMBEDDING_BATCH_SIZE,
            ):
                batch = chunk_models[
                    batch_start:
                    batch_start + EMBEDDING_BATCH_SIZE
                ]

                embeddings = generate_embeddings(
                    [chunk.content for chunk in batch]
                )

                for chunk_model, embedding in zip(
                    batch,
                    embeddings,
                    strict=True,
                ):
                    chunk_model.embedding = embedding

                completed_count = min(
                    batch_start + len(batch),
                    total_chunks,
                )

                document.processing_progress = min(
                    95,
                    50 + int(
                        completed_count / total_chunks * 45
                    ),
                )

                database.commit()

            document.status = "completed"
            document.processing_progress = 100
            document.error_message = None
            document.metadata_json = {
                **document.metadata_json,
                "chunk_count": total_chunks,
                "embedded_chunk_count": total_chunks,
                "embedding_model": settings.ollama_embedding_model,
                "embedding_dimension": 768,
                "character_count": total_characters,
                "page_count": page_count or None,
                "celery_task_id": self.request.id,
            }

            database.commit()

            logger.info(
                "Processed and embedded document %s into %s chunks",
                document.id,
                total_chunks,
            )

            return {
                "document_id": str(document.id),
                "status": "completed",
                "chunk_count": total_chunks,
                "embedded_chunk_count": total_chunks,
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
