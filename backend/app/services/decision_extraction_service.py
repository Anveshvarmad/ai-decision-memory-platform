import json
import re
from datetime import datetime
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings


settings = get_settings()


class ExtractedEvidence(BaseModel):
    chunk_index: int
    evidence_type: str = "supporting"
    relevance_score: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
    )
    explanation: str | None = None


class ExtractedDecision(BaseModel):
    title: str
    summary: str | None = None
    decision_statement: str
    reason: str | None = None
    alternatives: list[str] = []
    participants: list[str] = []
    related_entities: list[str] = []
    decision_date: datetime | None = None
    confidence_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
    )
    evidence: list[ExtractedEvidence] = []


class DecisionExtractionError(Exception):
    pass


def strip_markdown_fences(content: str) -> str:
    cleaned = content.strip()

    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned,
    )

    return cleaned.strip()


def parse_json_response(content: str) -> dict[str, Any]:
    cleaned = strip_markdown_fences(content)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end == -1 or end <= start:
            raise DecisionExtractionError(
                "The model did not return valid JSON"
            )

        try:
            payload = json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError as error:
            raise DecisionExtractionError(
                f"Unable to parse decision extraction JSON: {error}"
            ) from error

    if not isinstance(payload, dict):
        raise DecisionExtractionError(
            "Decision extraction response must be a JSON object"
        )

    return payload


def format_chunks_for_prompt(chunks: list[dict]) -> str:
    sections: list[str] = []

    for chunk in chunks:
        location_parts: list[str] = []

        if chunk.get("page_number") is not None:
            location_parts.append(
                f"page {chunk['page_number']}"
            )

        if chunk.get("section_title"):
            location_parts.append(
                chunk["section_title"]
            )

        location = (
            ", ".join(location_parts)
            if location_parts
            else "location unavailable"
        )

        sections.append(
            "\n".join(
                [
                    f"CHUNK_INDEX: {chunk['chunk_index']}",
                    f"LOCATION: {location}",
                    "CONTENT:",
                    chunk["content"],
                ]
            )
        )

    return "\n\n---\n\n".join(sections)


def extract_decisions_from_chunks(
    chunks: list[dict],
) -> list[ExtractedDecision]:
    if not chunks:
        return []

    document_context = format_chunks_for_prompt(chunks)

    system_prompt = """
You extract organizational decisions from internal company documents.

A decision is a committed or approved choice, not merely:
- a suggestion
- an unresolved discussion
- a question
- a possible future option
- general background information

Return valid JSON only.

Required JSON structure:

{
  "decisions": [
    {
      "title": "Short descriptive title",
      "summary": "One sentence summary",
      "decision_statement": "What was decided",
      "reason": "Why it was decided",
      "alternatives": ["Alternative 1", "Alternative 2"],
      "participants": ["Person or team"],
      "related_entities": ["Service, project, technology or incident"],
      "decision_date": "2026-03-18T00:00:00Z",
      "confidence_score": 0.0,
      "evidence": [
        {
          "chunk_index": 0,
          "evidence_type": "supporting",
          "relevance_score": 0.0,
          "explanation": "Why this chunk supports the decision"
        }
      ]
    }
  ]
}

Rules:
1. Use only the supplied chunks.
2. Do not invent missing facts.
3. Return an empty decisions list when no committed decision exists.
4. Every extracted decision must have at least one evidence item.
5. Evidence chunk indexes must exactly match supplied CHUNK_INDEX values.
6. Confidence must reflect how explicitly the decision is stated.
7. Use null for unknown date, reason, or summary.
8. Include rejected alternatives only when supported by the document.
9. Distinguish responsible implementers from approvers.
10. Do not return markdown or explanatory text outside JSON.
""".strip()

    user_prompt = f"""
Extract all committed organizational decisions from this document.

DOCUMENT CHUNKS:

{document_context}
""".strip()

    try:
        with httpx.Client(timeout=300.0) as client:
            response = client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_chat_model,
                    "stream": False,
                    "format": "json",
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
                    },
                },
            )

            response.raise_for_status()
            payload = response.json()

    except httpx.HTTPError as error:
        raise DecisionExtractionError(
            f"Unable to extract decisions with Ollama: {error}"
        ) from error

    content = payload.get("message", {}).get("content")

    if not content:
        raise DecisionExtractionError(
            "Ollama returned an empty extraction response"
        )

    parsed = parse_json_response(content)
    raw_decisions = parsed.get("decisions", [])

    if not isinstance(raw_decisions, list):
        raise DecisionExtractionError(
            "The decisions property must be a list"
        )

    decisions: list[ExtractedDecision] = []

    for raw_decision in raw_decisions:
        try:
            decision = ExtractedDecision.model_validate(
                raw_decision
            )
        except ValidationError:
            continue

        if not decision.evidence:
            continue

        decisions.append(decision)

    return decisions
