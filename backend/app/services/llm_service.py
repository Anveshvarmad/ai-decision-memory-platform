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
