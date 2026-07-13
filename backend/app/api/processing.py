import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import (
    StreamingResponse,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.document import Document
from app.models.workspace import WorkspaceMember
from app.services.document_stream_service import (
    stream_document_processing,
)
from app.services.workspace_processing_stream_service import (
    stream_workspace_processing,
)


router = APIRouter(
    prefix="/workspaces/{workspace_id}",
    tags=["Processing Events"],
)


@router.get(
    "/documents/{document_id}/events",
)
async def stream_document_events(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    request: Request,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
):
    del membership

    document_exists = database.scalar(
        select(Document.id).where(
            Document.id == document_id,
            Document.workspace_id
            == workspace_id,
        )
    )

    if document_exists is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    async def event_generator():
        async for event in (
            stream_document_processing(
                document_id=document_id,
                workspace_id=workspace_id,
            )
        ):
            if await request.is_disconnected():
                return

            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": (
                "no-cache, no-transform"
            ),
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/processing/events")
async def stream_workspace_events(
    workspace_id: uuid.UUID,
    request: Request,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
):
    del membership

    async def event_generator():
        async for event in (
            stream_workspace_processing(
                workspace_id=workspace_id,
            )
        ):
            if await request.is_disconnected():
                return

            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": (
                "no-cache, no-transform"
            ),
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
