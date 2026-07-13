import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workspace import Workspace


def normalize_slug(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")

    return slug or "workspace"


def create_unique_slug(
    database: Session,
    workspace_name: str,
) -> str:
    base_slug = normalize_slug(workspace_name)
    slug = base_slug

    existing = database.scalar(
        select(Workspace.id).where(
            Workspace.slug == slug
        )
    )

    if existing is None:
        return slug

    while True:
        suffix = uuid.uuid4().hex[:8]
        slug = f"{base_slug}-{suffix}"

        existing = database.scalar(
            select(Workspace.id).where(
                Workspace.slug == slug
            )
        )

        if existing is None:
            return slug
