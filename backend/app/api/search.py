import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_workspace_membership
from app.db.dependencies import get_db
from app.models.workspace import WorkspaceMember
from app.schemas.search import (
    SemanticSearchRequest,
    SemanticSearchResponse,
)
from app.services.search_service import semantic_search


router = APIRouter(
    prefix="/workspaces/{workspace_id}/search",
    tags=["Search"],
)


@router.post(
    "/semantic",
    response_model=SemanticSearchResponse,
)
def search_workspace_documents(
    workspace_id: uuid.UUID,
    search_data: SemanticSearchRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> SemanticSearchResponse:
    del membership

    results = semantic_search(
        database=database,
        workspace_id=workspace_id,
        query=search_data.query,
        limit=search_data.limit,
        minimum_similarity=search_data.minimum_similarity,
        document_ids=search_data.document_ids,
    )

    return SemanticSearchResponse(
        query=search_data.query,
        result_count=len(results),
        results=results,
    )
