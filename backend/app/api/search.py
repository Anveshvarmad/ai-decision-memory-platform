import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_workspace_membership
from app.db.dependencies import get_db
from app.models.workspace import WorkspaceMember
from app.schemas.search import (
    HybridSearchRequest,
    HybridSearchResponse,
    SearchComparisonResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
)
from app.services.search_service import (
    hybrid_search,
    semantic_search,
)


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


@router.post(
    "/hybrid",
    response_model=HybridSearchResponse,
)
def search_workspace_hybrid(
    workspace_id: uuid.UUID,
    search_data: HybridSearchRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> HybridSearchResponse:
    del membership

    (
        results,
        semantic_candidate_count,
        keyword_candidate_count,
    ) = hybrid_search(
        database=database,
        workspace_id=workspace_id,
        query=search_data.query,
        limit=search_data.limit,
        semantic_limit=search_data.semantic_limit,
        keyword_limit=search_data.keyword_limit,
        minimum_similarity=search_data.minimum_similarity,
        rrf_k=search_data.rrf_k,
        document_ids=search_data.document_ids,
        source_types=search_data.source_types,
    )

    return HybridSearchResponse(
        query=search_data.query,
        result_count=len(results),
        semantic_candidates=semantic_candidate_count,
        keyword_candidates=keyword_candidate_count,
        results=results,
    )


@router.post(
    "/compare",
    response_model=SearchComparisonResponse,
)
def compare_search_methods(
    workspace_id: uuid.UUID,
    search_data: HybridSearchRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> SearchComparisonResponse:
    del membership

    semantic_results = semantic_search(
        database=database,
        workspace_id=workspace_id,
        query=search_data.query,
        limit=search_data.limit,
        minimum_similarity=search_data.minimum_similarity,
        document_ids=search_data.document_ids,
    )

    hybrid_results, _, _ = hybrid_search(
        database=database,
        workspace_id=workspace_id,
        query=search_data.query,
        limit=search_data.limit,
        semantic_limit=search_data.semantic_limit,
        keyword_limit=search_data.keyword_limit,
        minimum_similarity=search_data.minimum_similarity,
        rrf_k=search_data.rrf_k,
        document_ids=search_data.document_ids,
        source_types=search_data.source_types,
    )

    return SearchComparisonResponse(
        query=search_data.query,
        semantic_results=semantic_results,
        hybrid_results=hybrid_results,
    )
