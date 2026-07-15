from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from app.api.dependencies import (
    get_db,
    get_current_user,
)
from app.schemas.decision_health import (
    DecisionHealthResponse,
)
from app.services.decision_health_service import (
    build_decision_health,
)


router = APIRouter(
    prefix="/workspaces",
    tags=["decision-health"],
)


@router.get(
    "/{workspace_id}/analytics/decision-health",
    response_model=DecisionHealthResponse,
)
def get_decision_health(
    workspace_id: str,
    stale_after_days: int = Query(
        default=180,
        ge=1,
        le=3650,
    ),
    db=Depends(get_db),

    current_user: object = Depends(
        get_current_user
    ),
) -> DecisionHealthResponse:
    return build_decision_health(
        db=db,
        workspace_id=workspace_id,
        stale_after_days=stale_after_days,
    )
