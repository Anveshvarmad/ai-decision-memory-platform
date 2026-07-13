import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse
from app.services.workspace_service import create_unique_slug


router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"],
)


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace(
    workspace_data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace = Workspace(
        name=workspace_data.name.strip(),
        slug=create_unique_slug(
            database,
            workspace_data.name,
        ),
    )

    database.add(workspace)
    database.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="owner",
    )

    database.add(membership)
    database.commit()
    database.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        created_at=workspace.created_at,
        role="owner",
    )


@router.get(
    "",
    response_model=list[WorkspaceResponse],
)
def list_workspaces(
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[WorkspaceResponse]:
    rows = database.execute(
        select(
            Workspace,
            WorkspaceMember.role,
        )
        .join(
            WorkspaceMember,
            WorkspaceMember.workspace_id == Workspace.id,
        )
        .where(
            WorkspaceMember.user_id == current_user.id
        )
        .order_by(Workspace.created_at.desc())
    ).all()

    return [
        WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            slug=workspace.slug,
            created_at=workspace.created_at,
            role=role,
        )
        for workspace, role in rows
    ]


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
def get_workspace(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace = database.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        created_at=workspace.created_at,
        role=membership.role,
    )


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_workspace(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    database: Session = Depends(get_db),
) -> None:
    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can delete this workspace",
        )

    workspace = database.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    database.delete(workspace)
    database.commit()
