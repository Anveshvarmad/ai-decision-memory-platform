from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    description="Organizational decision intelligence and RAG platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": settings.project_name,
        "docs": "/docs",
        "health": "/api/health",
    }
