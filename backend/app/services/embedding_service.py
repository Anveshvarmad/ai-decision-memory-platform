from collections.abc import Sequence

import httpx

from app.core.config import get_settings


settings = get_settings()

EXPECTED_EMBEDDING_DIMENSION = 768


class EmbeddingServiceError(Exception):
    pass


def validate_embedding(embedding: list[float]) -> list[float]:
    if len(embedding) != EXPECTED_EMBEDDING_DIMENSION:
        raise EmbeddingServiceError(
            "Unexpected embedding dimension. "
            f"Expected {EXPECTED_EMBEDDING_DIMENSION}, "
            f"received {len(embedding)}."
        )

    return embedding


def generate_embeddings(
    texts: Sequence[str],
) -> list[list[float]]:
    clean_texts = [
        text.strip()
        for text in texts
        if text and text.strip()
    ]

    if not clean_texts:
        return []

    try:
        with httpx.Client(timeout=180.0) as client:
            response = client.post(
                f"{settings.ollama_base_url}/api/embed",
                json={
                    "model": settings.ollama_embedding_model,
                    "input": clean_texts,
                    "truncate": True,
                },
            )

            response.raise_for_status()
            payload = response.json()

    except httpx.HTTPError as error:
        raise EmbeddingServiceError(
            f"Unable to generate embeddings with Ollama: {error}"
        ) from error

    embeddings = payload.get("embeddings")

    if not isinstance(embeddings, list):
        raise EmbeddingServiceError(
            "Ollama returned an invalid embedding response"
        )

    if len(embeddings) != len(clean_texts):
        raise EmbeddingServiceError(
            "Embedding count does not match input count"
        )

    return [
        validate_embedding(embedding)
        for embedding in embeddings
    ]


def generate_embedding(text: str) -> list[float]:
    embeddings = generate_embeddings([text])

    if not embeddings:
        raise EmbeddingServiceError(
            "Unable to generate an embedding for empty text"
        )

    return embeddings[0]
