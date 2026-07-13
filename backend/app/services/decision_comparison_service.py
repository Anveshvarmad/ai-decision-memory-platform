import json
import re
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.decision import (
    Decision,
    DecisionEvent,
    DecisionEvidence,
)
from app.models.document import (
    Document,
    DocumentChunk,
)
from app.schemas.comparison import (
    ComparisonClaim,
    DecisionComparisonResponse,
    DecisionComparisonResult,
    DecisionComparisonSnapshot,
)
from app.schemas.context import ReasoningCitation


settings = get_settings()


class DecisionComparisonError(Exception):
    pass


def safe_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value

    if value is None:
        return []

    return [value]


def load_decision(
    database: Session,
    workspace_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> Decision:
    decision = database.scalar(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.workspace_id == workspace_id,
        )
    )

    if decision is None:
        raise DecisionComparisonError(
            f"Decision {decision_id} was not found."
        )

    return decision


def load_evidence_sources(
    database: Session,
    decision: Decision,
    limit: int,
    prefix: str,
) -> list[dict[str, Any]]:
    rows = database.execute(
        select(
            DecisionEvidence,
            DocumentChunk,
            Document,
        )
        .join(
            DocumentChunk,
            DocumentChunk.id
            == DecisionEvidence.chunk_id,
        )
        .join(
            Document,
            Document.id
            == DocumentChunk.document_id,
        )
        .where(
            DecisionEvidence.decision_id
            == decision.id
        )
        .order_by(
            DecisionEvidence.relevance_score.desc()
        )
        .limit(limit)
    ).all()

    sources: list[dict[str, Any]] = []

    for index, (
        evidence,
        chunk,
        document,
    ) in enumerate(rows, start=1):
        source_id = (
            f"{prefix}-evidence-{index}-"
            f"{str(evidence.id)[:8]}"
        )

        sources.append(
            {
                "source_id": source_id,
                "source_type": "decision_evidence",
                "decision_id": decision.id,
                "document_id": document.id,
                "chunk_id": chunk.id,
                "title": (
                    f"{decision.title} evidence "
                    f"from {document.original_filename}"
                ),
                "content": chunk.content,
                "document_name": (
                    document.original_filename
                ),
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
                "score": float(
                    evidence.relevance_score or 0
                ),
            }
        )

    return sources


def load_timeline_sources(
    database: Session,
    decision: Decision,
    limit: int,
    prefix: str,
) -> list[dict[str, Any]]:
    events = list(
        database.scalars(
            select(DecisionEvent)
            .where(
                DecisionEvent.decision_id
                == decision.id
            )
            .order_by(
                DecisionEvent.event_date
                .asc()
                .nullslast(),
                DecisionEvent.created_at.asc(),
            )
            .limit(limit)
        )
    )

    sources: list[dict[str, Any]] = []

    for index, event in enumerate(
        events,
        start=1,
    ):
        source_id = (
            f"{prefix}-timeline-{index}-"
            f"{str(event.id)[:8]}"
        )

        content = "\n".join(
            [
                f"Event: {event.title}",
                f"Type: {event.event_type}",
                (
                    "Date: "
                    + (
                        event.event_date.isoformat()
                        if event.event_date
                        else "Unknown"
                    )
                ),
                (
                    "Description: "
                    f"{event.description or 'None'}"
                ),
            ]
        )

        sources.append(
            {
                "source_id": source_id,
                "source_type": "timeline_event",
                "decision_id": decision.id,
                "document_id": None,
                "chunk_id": None,
                "title": event.title,
                "content": content,
                "document_name": None,
                "page_number": None,
                "section_title": None,
                "score": 0.7,
            }
        )

    return sources


def build_decision_source(
    decision: Decision,
    prefix: str,
) -> dict[str, Any]:
    source_id = (
        f"{prefix}-decision-"
        f"{str(decision.id)[:8]}"
    )

    content = "\n".join(
        [
            f"Title: {decision.title}",
            f"Status: {decision.status}",
            (
                "Decision date: "
                + (
                    decision.decision_date.isoformat()
                    if decision.decision_date
                    else "Unknown"
                )
            ),
            (
                "Summary: "
                f"{decision.summary or 'Unknown'}"
            ),
            (
                "Statement: "
                f"{decision.decision_statement}"
            ),
            (
                "Reason: "
                f"{decision.reason or 'Unknown'}"
            ),
            (
                "Alternatives: "
                + ", ".join(
                    str(item)
                    for item
                    in safe_list(
                        decision.alternatives
                    )
                )
            ),
            (
                "Participants: "
                + ", ".join(
                    str(item)
                    for item
                    in safe_list(
                        decision.participants
                    )
                )
            ),
            (
                "Related entities: "
                + ", ".join(
                    str(item)
                    for item
                    in safe_list(
                        decision.related_entities
                    )
                )
            ),
            (
                "Confidence: "
                f"{float(decision.confidence_score or 0)}"
            ),
        ]
    )

    return {
        "source_id": source_id,
        "source_type": "decision",
        "decision_id": decision.id,
        "document_id": None,
        "chunk_id": None,
        "title": decision.title,
        "content": content,
        "document_name": None,
        "page_number": None,
        "section_title": None,
        "score": float(
            decision.confidence_score or 0
        ),
    }


def build_snapshot(
    decision: Decision,
    evidence_count: int,
    timeline_count: int,
) -> DecisionComparisonSnapshot:
    return DecisionComparisonSnapshot(
        decision_id=decision.id,
        title=decision.title,
        status=decision.status,
        summary=decision.summary,
        decision_statement=(
            decision.decision_statement
        ),
        reason=decision.reason,
        alternatives=safe_list(
            decision.alternatives
        ),
        participants=safe_list(
            decision.participants
        ),
        related_entities=safe_list(
            decision.related_entities
        ),
        confidence_score=float(
            decision.confidence_score or 0
        ),
        decision_date=(
            decision.decision_date.isoformat()
            if decision.decision_date
            else None
        ),
        evidence_count=evidence_count,
        timeline_event_count=timeline_count,
    )


def build_prompt_sources(
    sources: list[dict[str, Any]],
) -> str:
    blocks: list[str] = []

    for source in sources:
        blocks.append(
            "\n".join(
                [
                    (
                        "[SOURCE "
                        f"{source['source_id']}]"
                    ),
                    (
                        "source_type: "
                        f"{source['source_type']}"
                    ),
                    (
                        "decision_id: "
                        f"{source['decision_id']}"
                    ),
                    f"title: {source['title']}",
                    "content:",
                    source["content"],
                ]
            )
        )

    return "\n\n---\n\n".join(blocks)


def comparison_system_prompt() -> str:
    return """
You are an enterprise decision comparison analyst.

Compare two decisions using only the provided sources.

Rules:
1. Do not invent facts.
2. Every claim must contain direct source_ids.
3. A source must directly support the claim.
4. Distinguish similarities from differences.
5. Identify changes in reasons, alternatives,
   stakeholders, risks, impacts, status, and timeline.
6. Identify contradictions or conflicting evidence.
7. Do not recommend a preferred decision unless the
   evidence supports a clear preference.
8. Unsupported conclusions belong in uncertainties.
9. Return valid JSON only.
10. Do not use Markdown code fences.

Return exactly:

{
  "executive_summary": "...",
  "comparison_answer": "...",
  "preferred_decision_id": "UUID or null",
  "preference_reason": "... or null",
  "similarities": [
    {
      "text": "...",
      "source_ids": ["source-id"]
    }
  ],
  "differences": [],
  "changed_reasons": [],
  "changed_alternatives": [],
  "changed_stakeholders": [],
  "changed_risks": [],
  "changed_impacts": [],
  "conflicts": [],
  "uncertainties": [],
  "confidence": 0.0,
  "source_ids": ["all used source ids"]
}
""".strip()


def extract_json(value: str) -> dict[str, Any]:
    cleaned = value.strip()

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

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end == -1:
            raise DecisionComparisonError(
                "The comparison model returned invalid JSON."
            )

        try:
            payload = json.loads(
                cleaned[start:end + 1]
            )
        except json.JSONDecodeError as error:
            raise DecisionComparisonError(
                "Unable to parse comparison JSON: "
                f"{error}"
            ) from error

    if not isinstance(payload, dict):
        raise DecisionComparisonError(
            "Comparison output must be a JSON object."
        )

    return payload


def normalize_claims(
    value: Any,
    valid_source_ids: set[str],
) -> list[ComparisonClaim]:
    if not isinstance(value, list):
        return []

    claims: list[ComparisonClaim] = []

    for item in value:
        if isinstance(item, str):
            text = item.strip()
            source_ids: list[str] = []
        elif isinstance(item, dict):
            raw_text = item.get("text")

            if not isinstance(raw_text, str):
                continue

            text = raw_text.strip()

            raw_source_ids = item.get(
                "source_ids",
                [],
            )

            source_ids = [
                source_id
                for source_id in raw_source_ids
                if (
                    isinstance(source_id, str)
                    and source_id
                    in valid_source_ids
                )
            ]
        else:
            continue

        if not text:
            continue

        claims.append(
            ComparisonClaim(
                text=text,
                source_ids=source_ids,
                supported=bool(source_ids),
            )
        )

    return claims


def normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.5

    return round(
        min(max(confidence, 0), 1),
        4,
    )


def parse_result(
    payload: dict[str, Any],
    sources: list[dict[str, Any]],
) -> DecisionComparisonResult:
    valid_source_ids = {
        source["source_id"]
        for source in sources
    }

    source_ids = [
        source_id
        for source_id in payload.get(
            "source_ids",
            [],
        )
        if (
            isinstance(source_id, str)
            and source_id in valid_source_ids
        )
    ]

    preferred_decision_id = payload.get(
        "preferred_decision_id"
    )

    if preferred_decision_id:
        try:
            preferred_decision_id = uuid.UUID(
                str(preferred_decision_id)
            )
        except ValueError:
            preferred_decision_id = None

    return DecisionComparisonResult(
        executive_summary=str(
            payload.get(
                "executive_summary",
                "Comparison completed.",
            )
        ).strip(),
        comparison_answer=str(
            payload.get(
                "comparison_answer",
                "The evidence was insufficient.",
            )
        ).strip(),
        preferred_decision_id=(
            preferred_decision_id
        ),
        preference_reason=(
            str(payload["preference_reason"])
            if payload.get("preference_reason")
            else None
        ),
        similarities=normalize_claims(
            payload.get("similarities"),
            valid_source_ids,
        ),
        differences=normalize_claims(
            payload.get("differences"),
            valid_source_ids,
        ),
        changed_reasons=normalize_claims(
            payload.get("changed_reasons"),
            valid_source_ids,
        ),
        changed_alternatives=normalize_claims(
            payload.get(
                "changed_alternatives"
            ),
            valid_source_ids,
        ),
        changed_stakeholders=normalize_claims(
            payload.get(
                "changed_stakeholders"
            ),
            valid_source_ids,
        ),
        changed_risks=normalize_claims(
            payload.get("changed_risks"),
            valid_source_ids,
        ),
        changed_impacts=normalize_claims(
            payload.get("changed_impacts"),
            valid_source_ids,
        ),
        conflicts=normalize_claims(
            payload.get("conflicts"),
            valid_source_ids,
        ),
        uncertainties=normalize_claims(
            payload.get("uncertainties"),
            valid_source_ids,
        ),
        confidence=normalize_confidence(
            payload.get("confidence")
        ),
        source_ids=source_ids,
    )


def build_citations(
    result: DecisionComparisonResult,
    sources: list[dict[str, Any]],
) -> list[ReasoningCitation]:
    source_map = {
        source["source_id"]: source
        for source in sources
    }

    cited_ids: list[str] = []

    for source_id in result.source_ids:
        if source_id not in cited_ids:
            cited_ids.append(source_id)

    claim_groups = [
        result.similarities,
        result.differences,
        result.changed_reasons,
        result.changed_alternatives,
        result.changed_stakeholders,
        result.changed_risks,
        result.changed_impacts,
        result.conflicts,
        result.uncertainties,
    ]

    for claims in claim_groups:
        for claim in claims:
            for source_id in claim.source_ids:
                if source_id not in cited_ids:
                    cited_ids.append(source_id)

    citations: list[ReasoningCitation] = []

    for number, source_id in enumerate(
        cited_ids,
        start=1,
    ):
        source = source_map.get(source_id)

        if source is None:
            continue

        excerpt = source["content"][:600]

        if len(source["content"]) > 600:
            excerpt += "..."

        citations.append(
            ReasoningCitation(
                citation_number=number,
                source_id=source_id,
                source_type=(
                    source["source_type"]
                ),
                title=source["title"],
                document_id=(
                    source["document_id"]
                ),
                chunk_id=source["chunk_id"],
                decision_id=(
                    source["decision_id"]
                ),
                document_name=(
                    source["document_name"]
                ),
                page_number=(
                    source["page_number"]
                ),
                section_title=(
                    source["section_title"]
                ),
                excerpt=excerpt,
                score=source["score"],
            )
        )

    return citations


def calculate_coverage(
    result: DecisionComparisonResult,
) -> tuple[int, int, float]:
    claim_groups = [
        result.similarities,
        result.differences,
        result.changed_reasons,
        result.changed_alternatives,
        result.changed_stakeholders,
        result.changed_risks,
        result.changed_impacts,
        result.conflicts,
        result.uncertainties,
    ]

    claims = [
        claim
        for group in claim_groups
        for claim in group
    ]

    supported = sum(
        1
        for claim in claims
        if claim.supported
    )

    unsupported = len(claims) - supported

    coverage = (
        supported / len(claims)
        if claims
        else 1.0
    )

    return (
        supported,
        unsupported,
        round(coverage, 4),
    )


def compare_decisions(
    database: Session,
    workspace_id: uuid.UUID,
    decision_a_id: uuid.UUID,
    decision_b_id: uuid.UUID,
    question: str,
    evidence_limit: int,
    timeline_limit: int,
) -> DecisionComparisonResponse:
    if decision_a_id == decision_b_id:
        raise DecisionComparisonError(
            "Select two different decisions."
        )

    decision_a = load_decision(
        database,
        workspace_id,
        decision_a_id,
    )

    decision_b = load_decision(
        database,
        workspace_id,
        decision_b_id,
    )

    sources_a = [
        build_decision_source(
            decision_a,
            "a",
        ),
        *load_evidence_sources(
            database,
            decision_a,
            evidence_limit,
            "a",
        ),
        *load_timeline_sources(
            database,
            decision_a,
            timeline_limit,
            "a",
        ),
    ]

    sources_b = [
        build_decision_source(
            decision_b,
            "b",
        ),
        *load_evidence_sources(
            database,
            decision_b,
            evidence_limit,
            "b",
        ),
        *load_timeline_sources(
            database,
            decision_b,
            timeline_limit,
            "b",
        ),
    ]

    sources = sources_a + sources_b

    user_prompt = "\n\n".join(
        [
            f"Comparison question:\n{question}",
            (
                "Decision A ID:\n"
                f"{decision_a.id}"
            ),
            (
                "Decision B ID:\n"
                f"{decision_b.id}"
            ),
            "Sources:",
            build_prompt_sources(sources),
        ]
    )

    timeout = httpx.Timeout(
        connect=20,
        read=900,
        write=60,
        pool=20,
    )

    try:
        with httpx.Client(
            timeout=timeout
        ) as client:
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
                    "format": "json",
                    "keep_alive": "10m",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                comparison_system_prompt()
                            ),
                        },
                        {
                            "role": "user",
                            "content": user_prompt,
                        },
                    ],
                    "options": {
                        "temperature": 0,
                        "num_predict": 2200,
                        "num_ctx": 8192,
                    },
                },
            )

            response.raise_for_status()
            response_payload = response.json()

    except httpx.HTTPError as error:
        raise DecisionComparisonError(
            "Unable to compare decisions with "
            f"Ollama: {error}"
        ) from error

    content = response_payload.get(
        "message",
        {},
    ).get("content")

    if not content:
        raise DecisionComparisonError(
            "Ollama returned an empty comparison."
        )

    result = parse_result(
        extract_json(content),
        sources,
    )

    citations = build_citations(
        result,
        sources,
    )

    (
        supported_claims,
        unsupported_claims,
        citation_coverage,
    ) = calculate_coverage(result)

    evidence_a_count = sum(
        source["source_type"]
        == "decision_evidence"
        for source in sources_a
    )

    timeline_a_count = sum(
        source["source_type"]
        == "timeline_event"
        for source in sources_a
    )

    evidence_b_count = sum(
        source["source_type"]
        == "decision_evidence"
        for source in sources_b
    )

    timeline_b_count = sum(
        source["source_type"]
        == "timeline_event"
        for source in sources_b
    )

    return DecisionComparisonResponse(
        question=question,
        decision_a=build_snapshot(
            decision_a,
            evidence_a_count,
            timeline_a_count,
        ),
        decision_b=build_snapshot(
            decision_b,
            evidence_b_count,
            timeline_b_count,
        ),
        result=result,
        citations=citations,
        model=settings.ollama_chat_model,
        total_sources=len(sources),
        supported_claims=supported_claims,
        unsupported_claims=unsupported_claims,
        citation_coverage=(
            citation_coverage
        ),
    )
