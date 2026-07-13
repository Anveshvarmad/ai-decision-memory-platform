from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.context import router as context_router
from app.api.decisions import router as decision_router
from app.api.documents import router as document_router
from app.api.graph import router as graph_router
from app.api.health import router as health_router
from app.api.search import router as search_router
from app.api.timelines import router as timeline_router
from app.api.workspaces import router as workspace_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title=settings.project_name,
    version="0.9.0",
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
app.include_router(auth_router, prefix="/api")
app.include_router(workspace_router, prefix="/api")
app.include_router(document_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(context_router, prefix="/api")
app.include_router(decision_router, prefix="/api")
app.include_router(timeline_router, prefix="/api")
app.include_router(graph_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": settings.project_name,
        "version": "0.9.0",
        "docs": "/docs",
        "health": "/api/health",
    }
