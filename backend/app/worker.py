from celery import Celery

from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "decision_memory",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.document_tasks",
        "app.tasks.decision_tasks",
        "app.tasks.timeline_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
)
