import os
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_workspace_membership
from app.core.config import get_settings
from app.db.dependencies import get_db
from app.models.document import Document, DocumentChunk
from app.models.workspace import WorkspaceMember
from app.schemas.document import (
    DocumentChunkResponse,
    DocumentDetailResponse,
    DocumentResponse,
    DocumentRetryResponse,
    DocumentUploadResponse,
)
from app.tasks.document_tasks import process_document


router = APIRouter(
    prefix="/workspaces/{workspace_id}/documents",
    tags=["Documents"],
)

settings = get_settings()

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/csv",
    "application/json",
    "text/json",
    "application/octet-stream",
}


def get_document_or_404(
    database: Session,
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Document:
    document = database.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


@router.post(
    "",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DocumentUploadResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A filename is required",
        )

    original_filename = Path(file.filename).name
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Unsupported file type. Allowed extensions: "
                + ", ".join(sorted(ALLOWED_EXTENSIONS))
            ),
        )

    content_type = file.content_type or "application/octet-stream"

    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type: {content_type}",
        )

    upload_directory = Path(settings.upload_directory)
    upload_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    stored_path = upload_directory / stored_filename
    maximum_bytes = settings.max_upload_size_mb * 1024 * 1024

    total_size = 0

    try:
        with stored_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)

                if total_size > maximum_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            "File exceeds the "
                            f"{settings.max_upload_size_mb} MB limit"
                        ),
                    )

                destination.write(chunk)

    except Exception:
        stored_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

    document = Document(
        workspace_id=workspace_id,
        filename=stored_filename,
        original_filename=original_filename,
        file_path=str(stored_path),
        mime_type=content_type,
        file_size=total_size,
        source_type="upload",
        status="pending",
        processing_progress=0,
        metadata_json={
            "extension": extension,
            "uploaded_by_membership_id": str(membership.id)
            if membership
            else None,
        },
    )

    database.add(document)
    database.commit()
    database.refresh(document)

    task = process_document.delay(str(document.id))

    document.metadata_json = {
        **document.metadata_json,
        "celery_task_id": task.id,
    }

    database.commit()
    database.refresh(document)

    return DocumentUploadResponse(
        document=DocumentResponse.model_validate(document),
        task_id=task.id,
    )


@router.get(
    "",
    response_model=list[DocumentResponse],
)
def list_documents(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> list[Document]:
    del membership

    return list(
        database.scalars(
            select(Document)
            .where(Document.workspace_id == workspace_id)
            .order_by(Document.created_at.desc())
        )
    )


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
)
def get_document(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DocumentDetailResponse:
    del membership

    document = get_document_or_404(
        database,
        workspace_id,
        document_id,
    )

    chunk_count = database.scalar(
        select(func.count(DocumentChunk.id)).where(
            DocumentChunk.document_id == document.id
        )
    ) or 0

    return DocumentDetailResponse(
        **DocumentResponse.model_validate(document).model_dump(),
        chunk_count=chunk_count,
    )


@router.get(
    "/{document_id}/chunks",
    response_model=list[DocumentChunkResponse],
)
def list_document_chunks(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    limit: int = 100,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> list[DocumentChunk]:
    del membership

    document = get_document_or_404(
        database,
        workspace_id,
        document_id,
    )

    safe_limit = min(max(limit, 1), 500)

    return list(
        database.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.chunk_index)
            .limit(safe_limit)
        )
    )


@router.post(
    "/{document_id}/retry",
    response_model=DocumentRetryResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_document(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> DocumentRetryResponse:
    del membership

    document = get_document_or_404(
        database,
        workspace_id,
        document_id,
    )

    if document.status in {"pending", "processing"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already being processed",
        )

    if not Path(document.file_path).exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The original uploaded file is missing",
        )

    document.status = "pending"
    document.processing_progress = 0
    document.error_message = None

    database.commit()

    task = process_document.delay(str(document.id))

    document.metadata_json = {
        **document.metadata_json,
        "celery_task_id": task.id,
    }

    database.commit()

    return DocumentRetryResponse(
        document_id=document.id,
        status="pending",
        task_id=task.id,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> None:
    if membership.role not in {"owner", "admin", "member"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete documents",
        )

    document = get_document_or_404(
        database,
        workspace_id,
        document_id,
    )

    file_path = Path(document.file_path)

    database.delete(document)
    database.commit()

    try:
        os.remove(file_path)
    except FileNotFoundError:
        pass
