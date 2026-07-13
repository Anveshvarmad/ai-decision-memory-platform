import json
from datetime import datetime
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.config import get_settings


settings = get_settings()


class ExtractedTimelineEvent(BaseModel):
    event_type: str
    title: str
    description: str | None = None
    event_date: datetime | None = None
    chunk_indexes: list[int] = Field(default_factory=list)
    confidence_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
    )

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_event_type(cls, value: str) -> str:
        normalized = str(value).strip().lower()

        aliases = {
            "issue": "problem",
            "challenge": "problem",
            "outage": "incident",
            "suggestion": "proposal",
            "alternative": "proposal",
            "meeting": "discussion",
            "decision": "approval",
            "approved": "approval",
            "implementation_plan": "implementation",
            "migration": "implementation",
            "verification": "validation",
            "testing": "validation",
            "deployment": "rollout",
            "release": "rollout",
            "rejected": "rejection",
        }

        normalized = aliases.get(normalized, normalized)

        allowed = {
            "problem",
            "incident",
            "proposal",
            "discussion",
            "approval",
            "implementation",
            "validation",
            "rollout",
            "rejection",
            "other",
        }

        return normalized if normalized in allowed else "other"


class TimelineExtractionResult(BaseModel):
    events: list[ExtractedTimelineEvent] = Field(
        default_factory=list
    )


class TimelineExtractionError(Exception):
    pass


TIMELINE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "event_type": {
                        "type": "string",
                        "enum": [
                            "problem",
                            "incident",
                            "proposal",
                            "discussion",
                            "approval",
                            "implementation",
                            "validation",
                            "rollout",
                            "rejection",
                            "other",
                        ],
                    },
                    "title": {
                        "type": "string",
                    },
                    "description": {
                        "anyOf": [
                            {"type": "string"},
                            {"type": "null"},
                        ],
                    },
                    "event_date": {
                        "anyOf": [
                            {
                                "type": "string",
                                "format": "date-time",
                            },
                            {"type": "null"},
                        ],
                    },
                    "chunk_indexes": {
                        "type": "array",
                        "items": {
                            "type": "integer",
                        },
                    },
                    "confidence_score": {
                        "type": "number",
                        "minimum": 0.0,
                        "maximum": 1.0,
                    },
                },
                "required": [
                    "event_type",
                    "title",
                    "description",
                    "event_date",
                    "chunk_indexes",
                    "confidence_score",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["events"],
    "additionalProperties": False,
}


def format_chunks_for_prompt(
    chunks: list[dict],
) -> str:
    formatted_chunks: list[str] = []

    for chunk in chunks:
        formatted_chunks.append(
            "\n".join(
                [
                    f"CHUNK_INDEX: {chunk['chunk_index']}",
                    f"PAGE: {chunk.get('page_number')}",
                    f"SECTION: {chunk.get('section_title')}",
                    "CONTENT:",
                    chunk["content"],
                ]
            )
        )

    return "\n\n---\n\n".join(formatted_chunks)


def extract_timeline_events(
    decision_title: str,
    decision_statement: str,
    decision_reason: str | None,
    chunks: list[dict],
) -> list[ExtractedTimelineEvent]:
    if not chunks:
        return []

    context = format_chunks_for_prompt(chunks)

    system_prompt = """
You extract chronological organizational decision events.

Use only the supplied evidence.

Rules:
1. Do not invent dates, people, or actions.
2. Use null when an exact date is unavailable.
3. Every event must reference at least one valid CHUNK_INDEX.
4. Extract only events connected to the supplied decision.
5. Keep approval separate from implementation.
6. A future target date may be a rollout event.
7. Return an empty events array when no supported timeline exists.
8. Keep titles concise.
9. Keep descriptions below 300 characters.
10. Return no more than 8 events.
""".strip()

    schema_text = json.dumps(
        TIMELINE_JSON_SCHEMA,
        separators=(",", ":"),
    )

    user_prompt = f"""
Decision title:
{decision_title}

Decision statement:
{decision_statement}

Decision reason:
{decision_reason or "Unknown"}

Evidence chunks:
{context}

Return JSON matching this schema exactly:
{schema_text}
""".strip()

    timeout = httpx.Timeout(
        connect=20.0,
        read=900.0,
        write=60.0,
        pool=20.0,
    )

    last_error: Exception | None = None

    for attempt in range(2):
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(
                    f"{settings.ollama_base_url}/api/chat",
                    json={
                        "model": settings.ollama_chat_model,
                        "stream": False,
                        "format": TIMELINE_JSON_SCHEMA,
                        "keep_alive": "10m",
                        "messages": [
                            {
                                "role": "system",
                                "content": system_prompt,
                            },
                            {
                                "role": "user",
                                "content": user_prompt,
                            },
                        ],
                        "options": {
                            "temperature": 0.0,
                            "num_predict": 1800,
                            "num_ctx": 4096,
                        },
                    },
                )

                response.raise_for_status()
                payload = response.json()

            content = payload.get(
                "message",
                {},
            ).get("content")

            if not content:
                raise TimelineExtractionError(
                    "Ollama returned an empty timeline response"
                )

            parsed_json = json.loads(content)

            parsed_result = (
                TimelineExtractionResult.model_validate(
                    parsed_json
                )
            )

            valid_chunk_indexes = {
                chunk["chunk_index"]
                for chunk in chunks
            }

            validated_events: list[
                ExtractedTimelineEvent
            ] = []

            for event in parsed_result.events:
                event.chunk_indexes = [
                    index
                    for index in event.chunk_indexes
                    if index in valid_chunk_indexes
                ]

                if not event.chunk_indexes:
                    continue

                validated_events.append(event)

            return validated_events

        except (
            httpx.HTTPError,
            json.JSONDecodeError,
            ValidationError,
            TimelineExtractionError,
        ) as error:
            last_error = error

            if attempt == 1:
                raise TimelineExtractionError(
                    "Unable to extract a valid timeline "
                    f"after retry: {error}"
                ) from error

    raise TimelineExtractionError(
        f"Timeline extraction failed: {last_error}"
    )
