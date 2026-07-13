import json
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.context import (
    DecisionReasoningResult,
    RankedContextItem,
    ReasoningTimelineItem,
    RelatedDecisionItem,
)


settings = get_settings()


class DecisionReasoningError(Exception):
    pass


def build_ranked_context_prompt(
    ranked_items: list[RankedContextItem],
) -> str:
    sections: list[str] = []

    for index, item in enumerate(
        ranked_items,
        start=1,
    ):
        metadata = json.dumps(
            item.metadata,
            ensure_ascii=False,
            default=str,
        )

        sections.append(
            "\n".join(
                [
                    f"[SOURCE {index}]",
                    f"source_id: {item.source_id}",
                    f"source_type: {item.source_type}",
                    f"title: {item.title}",
                    f"score: {item.score}",
                    (
                        "decision_id: "
                        f"{item.decision_id or ''}"
                    ),
                    (
                        "document_id: "
                        f"{item.document_id or ''}"
                    ),
                    (
                        "chunk_id: "
                        f"{item.chunk_id or ''}"
                    ),
                    f"metadata: {metadata}",
                    "content:",
                    item.content,
                ]
            )
        )

    return "\n\n---\n\n".join(sections)


def reasoning_system_prompt() -> str:
    return """
You are a decision intelligence analyst.

You receive ranked evidence from:
- structured decision records,
- decision evidence,
- timeline events,
- graph relationships,
- document chunks.

Your task is to create a grounded organizational decision report.

Strict rules:
1. Use only the supplied sources.
2. Do not invent people, dates, alternatives, risks, impacts, or decisions.
3. Every factual claim must be supported by one or more source_ids.
4. Prefer approved structured decisions over candidate decisions.
5. Clearly state uncertainty when evidence is incomplete or conflicting.
6. Do not treat a participant as an approver unless the evidence says so.
7. Do not infer a timeline date unless it is explicitly present.
8. Return valid JSON only.
9. Do not wrap JSON in Markdown.
10. Use empty arrays when information is unavailable.

Return exactly this JSON shape:

{
  "answer": "Concise natural-language answer to the user's question.",
  "summary": "Short executive summary.",
  "decision_title": "Title or null",
  "decision_status": "approved, candidate, rejected, or null",
  "decision_date": "ISO date string or null",
  "confidence": 0.0,
  "reasons": ["..."],
  "alternatives": ["..."],
  "stakeholders": ["..."],
  "risks": ["..."],
  "impacts": ["..."],
  "timeline": [
    {
      "date": "ISO date string or null",
      "title": "...",
      "description": "... or null",
      "source_ids": ["source-id"]
    }
  ],
  "related_decisions": [
    {
      "decision_id": "UUID or null",
      "title": "...",
      "relationship": "... or null",
      "status": "... or null",
      "source_ids": ["source-id"]
    }
  ],
  "uncertainties": ["..."],
  "source_ids": ["all source ids used"]
}
""".strip()


def remove_code_fences(value: str) -> str:
    cleaned = value.strip()

    if cleaned.startswith("```"):
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


def extract_json_object(value: str) -> dict[str, Any]:
    cleaned = remove_code_fences(value)

    try:
        payload = json.loads(cleaned)

        if not isinstance(payload, dict):
            raise DecisionReasoningError(
                "Reasoning model returned a non-object JSON response"
            )

        return payload

    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end == -1:
            raise DecisionReasoningError(
                "Reasoning model returned invalid JSON"
            )

        try:
            payload = json.loads(
                cleaned[start:end + 1]
            )
        except json.JSONDecodeError as error:
            raise DecisionReasoningError(
                "Unable to parse reasoning JSON: "
                f"{error}"
            ) from error

        if not isinstance(payload, dict):
            raise DecisionReasoningError(
                "Reasoning JSON must be an object"
            )

        return payload


def normalize_string_list(
    value: Any,
) -> list[str]:
    if not isinstance(value, list):
        return []

    result: list[str] = []

    for item in value:
        if isinstance(item, str):
            cleaned = item.strip()

            if cleaned:
                result.append(cleaned)

    return result


def normalize_timeline(
    value: Any,
) -> list[ReasoningTimelineItem]:
    if not isinstance(value, list):
        return []

    result: list[ReasoningTimelineItem] = []

    for item in value:
        if not isinstance(item, dict):
            continue

        title = item.get("title")

        if not isinstance(title, str):
            continue

        result.append(
            ReasoningTimelineItem(
                date=(
                    str(item["date"])
                    if item.get("date")
                    else None
                ),
                title=title.strip(),
                description=(
                    str(item["description"])
                    if item.get("description")
                    else None
                ),
                source_ids=normalize_string_list(
                    item.get("source_ids")
                ),
            )
        )

    return result


def normalize_related_decisions(
    value: Any,
) -> list[RelatedDecisionItem]:
    if not isinstance(value, list):
        return []

    result: list[RelatedDecisionItem] = []

    for item in value:
        if not isinstance(item, dict):
            continue

        title = item.get("title")

        if not isinstance(title, str):
            continue

        result.append(
            RelatedDecisionItem(
                decision_id=item.get(
                    "decision_id"
                ),
                title=title.strip(),
                relationship=(
                    str(item["relationship"])
                    if item.get("relationship")
                    else None
                ),
                status=(
                    str(item["status"])
                    if item.get("status")
                    else None
                ),
                source_ids=normalize_string_list(
                    item.get("source_ids")
                ),
            )
        )

    return result


def normalize_confidence(
    value: Any,
) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.5

    return round(
        min(max(numeric, 0.0), 1.0),
        4,
    )


def validate_source_ids(
    result: DecisionReasoningResult,
    ranked_items: list[RankedContextItem],
) -> DecisionReasoningResult:
    valid_source_ids = {
        item.source_id
        for item in ranked_items
    }

    result.source_ids = [
        source_id
        for source_id in result.source_ids
        if source_id in valid_source_ids
    ]

    for timeline_item in result.timeline:
        timeline_item.source_ids = [
            source_id
            for source_id
            in timeline_item.source_ids
            if source_id in valid_source_ids
        ]

    for related_decision in (
        result.related_decisions
    ):
        related_decision.source_ids = [
            source_id
            for source_id
            in related_decision.source_ids
            if source_id in valid_source_ids
        ]

    return result


def parse_reasoning_result(
    payload: dict[str, Any],
    ranked_items: list[RankedContextItem],
) -> DecisionReasoningResult:
    answer = payload.get("answer")
    summary = payload.get("summary")

    if not isinstance(answer, str):
        answer = (
            "The available evidence was insufficient "
            "to produce a complete answer."
        )

    if not isinstance(summary, str):
        summary = answer

    result = DecisionReasoningResult(
        answer=answer.strip(),
        summary=summary.strip(),
        decision_title=(
            str(payload["decision_title"])
            if payload.get("decision_title")
            else None
        ),
        decision_status=(
            str(payload["decision_status"])
            if payload.get("decision_status")
            else None
        ),
        decision_date=(
            str(payload["decision_date"])
            if payload.get("decision_date")
            else None
        ),
        confidence=normalize_confidence(
            payload.get("confidence")
        ),
        reasons=normalize_string_list(
            payload.get("reasons")
        ),
        alternatives=normalize_string_list(
            payload.get("alternatives")
        ),
        stakeholders=normalize_string_list(
            payload.get("stakeholders")
        ),
        risks=normalize_string_list(
            payload.get("risks")
        ),
        impacts=normalize_string_list(
            payload.get("impacts")
        ),
        timeline=normalize_timeline(
            payload.get("timeline")
        ),
        related_decisions=(
            normalize_related_decisions(
                payload.get(
                    "related_decisions"
                )
            )
        ),
        uncertainties=normalize_string_list(
            payload.get("uncertainties")
        ),
        source_ids=normalize_string_list(
            payload.get("source_ids")
        ),
    )

    return validate_source_ids(
        result=result,
        ranked_items=ranked_items,
    )


def reason_over_context(
    query: str,
    query_type: str,
    ranked_items: list[RankedContextItem],
) -> DecisionReasoningResult:
    if not ranked_items:
        return DecisionReasoningResult(
            answer=(
                "I could not find enough evidence "
                "to answer this question."
            ),
            summary=(
                "No relevant decision evidence was found."
            ),
            confidence=0.0,
            uncertainties=[
                "No ranked context items were available."
            ],
            source_ids=[],
        )

    context_prompt = build_ranked_context_prompt(
        ranked_items
    )

    user_prompt = f"""
Question type:
{query_type}

User question:
{query}

Ranked decision context:
{context_prompt}

Produce the required grounded JSON response.
""".strip()

    timeout = httpx.Timeout(
        connect=20.0,
        read=900.0,
        write=60.0,
        pool=20.0,
    )

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                (
                    f"{settings.ollama_base_url}"
                    "/api/chat"
                ),
                json={
                    "model": (
                        settings.ollama_chat_model
                    ),
                    "stream": False,
                    "keep_alive": "10m",
                    "format": "json",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                reasoning_system_prompt()
                            ),
                        },
                        {
                            "role": "user",
                            "content": user_prompt,
                        },
                    ],
                    "options": {
                        "temperature": 0.0,
                        "num_predict": 1800,
                        "num_ctx": 8192,
                    },
                },
            )

            response.raise_for_status()
            response_payload = response.json()

    except httpx.HTTPError as error:
        raise DecisionReasoningError(
            "Unable to generate decision reasoning "
            f"with Ollama: {error}"
        ) from error

    content = response_payload.get(
        "message",
        {},
    ).get("content")

    if not content:
        raise DecisionReasoningError(
            "Ollama returned an empty reasoning response"
        )

    parsed_payload = extract_json_object(
        content
    )

    return parse_reasoning_result(
        payload=parsed_payload,
        ranked_items=ranked_items,
    )
