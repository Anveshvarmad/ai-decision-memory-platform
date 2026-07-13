import httpx
import redis
from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.dependencies import get_db
from fastapi import Depends


router = APIRouter(prefix="/health", tags=["Health"])
settings = get_settings()


@router.get("")
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.project_name,
        "environment": settings.environment,
    }


@router.get("/database")
def database_health(
    database: Session = Depends(get_db),
) -> dict[str, str]:
    database.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "database": "postgresql",
    }


@router.get("/redis")
def redis_health() -> dict[str, str]:
    client = redis.from_url(settings.redis_url)
    client.ping()

    return {
        "status": "healthy",
        "cache": "redis",
    }


@router.get("/ollama")
async def ollama_health() -> dict[str, object]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.ollama_base_url}/api/tags")
        response.raise_for_status()

    models = [
        model.get("name")
        for model in response.json().get("models", [])
    ]

    return {
        "status": "healthy",
        "provider": "ollama",
        "models": models,
    }
