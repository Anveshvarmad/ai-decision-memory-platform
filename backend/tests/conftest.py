import os

import pytest
from fastapi.testclient import TestClient


os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://decision_user:decision_password@postgres:5432/decision_memory",
)

os.environ.setdefault(
    "REDIS_URL",
    "redis://redis:6379/0",
)

os.environ.setdefault(
    "CELERY_BROKER_URL",
    "redis://redis:6379/1",
)

os.environ.setdefault(
    "CELERY_RESULT_BACKEND",
    "redis://redis:6379/2",
)

os.environ.setdefault(
    "OLLAMA_BASE_URL",
    "http://host.docker.internal:11434",
)

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
