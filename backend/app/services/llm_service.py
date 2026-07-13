import httpx

from app.core.config import get_settings


settings = get_settings()


class LLMServiceError(Exception):
    pass


def generate_answer(
    question: str,
    context: str,
) -> str:
    system_prompt = """
You are an organizational decision-memory assistant.

Answer only from the provided evidence.

Rules:
1. Do not use outside knowledge.
2. Do not invent facts, names, dates, approvals, or reasons.
3. Cite evidence using markers such as [1], [2], and [3].
4. Every important factual claim must have a citation.
5. If the evidence is insufficient, say:
   "I could not find enough evidence in the workspace to answer this question."
6. Keep answers clear and direct.
7. When the question asks why a decision was made, explain:
   - the decision
   - the reason
   - alternatives considered
   - participants or approvers
   - implementation details, when available
""".strip()

    user_prompt = f"""
Question:
{question}

Evidence:
{context}

Provide a grounded answer using only the evidence above.
""".strip()

    try:
        with httpx.Client(timeout=300.0) as client:
            response = client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_chat_model,
                    "stream": False,
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
                        "temperature": 0.1,
                    },
                },
            )

            response.raise_for_status()
            payload = response.json()

    except httpx.HTTPError as error:
        raise LLMServiceError(
            f"Unable to generate an answer with Ollama: {error}"
        ) from error

    message = payload.get("message", {})
    content = message.get("content")

    if not content:
        raise LLMServiceError(
            "Ollama returned an empty response"
        )

    return content.strip()


def generate_decision_aware_answer(
    question: str,
    query_type: str,
    decision_context: str,
    document_context: str,
) -> str:
    system_prompt = """
You are an organizational decision-memory assistant.

Use only the supplied evidence. Never invent names, dates, approvals,
reasons, or outcomes. Prefer reviewed structured decision records.
Clearly distinguish approved decisions from candidate decisions.
Cite document evidence using markers such as [1] and [2].
If evidence conflicts or is insufficient, say so directly.
""".strip()

    user_prompt = f"""
Question type:
{query_type}

Question:
{question}

Structured decision context:
{decision_context}

Retrieved document evidence:
{document_context}

Answer using the strongest available evidence.
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
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_chat_model,
                    "stream": False,
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
                        "temperature": 0.1,
                        "num_predict": 1000,
                        "num_ctx": 8192,
                    },
                },
            )

            response.raise_for_status()
            payload = response.json()

    except httpx.HTTPError as error:
        raise LLMServiceError(
            f"Unable to generate decision-aware answer: {error}"
        ) from error

    content = payload.get("message", {}).get("content")

    if not content:
        raise LLMServiceError(
            "Ollama returned an empty decision-aware response"
        )

    return content.strip()


def generate_decision_aware_answer(
    question: str,
    query_type: str,
    decision_context: str,
    document_context: str,
) -> str:
    system_prompt = """
You are an organizational decision-memory assistant.

You receive:
1. Structured decision records
2. Decision timeline events
3. Graph relationships
4. Linked decision evidence
5. Retrieved document evidence

Rules:
- Use only the supplied evidence.
- Never invent names, dates, approvals, reasons, or outcomes.
- Prefer reviewed structured decision records when available.
- Clearly distinguish approved decisions from candidate decisions.
- Cite document evidence using markers such as [1] and [2].
- When structured records contain no direct document marker, say
  "According to the structured decision record."
- If evidence conflicts, explicitly describe the disagreement.
- If evidence is insufficient, say so directly.
- Keep the response concise but complete.
""".strip()

    type_guidance = {
        "why": (
            "Explain the decision, reasons, triggering events, "
            "and alternatives."
        ),
        "who": (
            "Identify approvers, participants, owners, and "
            "implementers. Do not confuse their roles."
        ),
        "when": (
            "Present relevant dates and events chronologically."
        ),
        "alternatives": (
            "List alternatives and explain why they were not selected."
        ),
        "status": (
            "State the current review status, date, and whether "
            "the decision remains active."
        ),
        "impact": (
            "Explain affected systems, services, incidents, and "
            "implementation consequences."
        ),
        "conflict": (
            "Identify possible contradictions or superseding "
            "decisions. Do not claim a conflict without evidence."
        ),
        "relationship": (
            "Explain connected people, services, technologies, "
            "documents, incidents, and projects."
        ),
        "general": (
            "Answer using the most relevant decision information."
        ),
    }

    guidance = type_guidance.get(
        query_type,
        type_guidance["general"],
    )

    user_prompt = f"""
Question type:
{query_type}

Question:
{question}

Response guidance:
{guidance}

Structured decision context:
{decision_context}

Retrieved document evidence:
{document_context}

Answer the question using the strongest available evidence.
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
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_chat_model,
                    "stream": False,
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
                        "temperature": 0.1,
                        "num_predict": 1000,
                        "num_ctx": 8192,
                    },
                },
            )

            response.raise_for_status()
            payload = response.json()

    except httpx.HTTPError as error:
        raise LLMServiceError(
            "Unable to generate a decision-aware "
            f"answer with Ollama: {error}"
        ) from error

    content = payload.get(
        "message",
        {},
    ).get("content")

    if not content:
        raise LLMServiceError(
            "Ollama returned an empty decision-aware response"
        )

    return content.strip()
