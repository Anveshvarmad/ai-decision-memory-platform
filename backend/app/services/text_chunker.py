import re


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def estimate_token_count(text: str) -> int:
    return max(1, len(text) // 4)


def find_chunk_end(
    text: str,
    start: int,
    target_end: int,
) -> int:
    if target_end >= len(text):
        return len(text)

    search_start = start + int((target_end - start) * 0.65)

    boundaries = [
        text.rfind("\n\n", search_start, target_end),
        text.rfind(". ", search_start, target_end),
        text.rfind("\n", search_start, target_end),
        text.rfind(" ", search_start, target_end),
    ]

    best_boundary = max(boundaries)

    if best_boundary > start:
        return best_boundary + 1

    return target_end


def chunk_text(
    text: str,
    chunk_size: int,
    overlap: int,
) -> list[str]:
    normalized = normalize_text(text)

    if not normalized:
        return []

    if overlap >= chunk_size:
        raise ValueError(
            "Chunk overlap must be smaller than chunk size"
        )

    chunks: list[str] = []
    start = 0

    while start < len(normalized):
        target_end = min(
            start + chunk_size,
            len(normalized),
        )

        end = find_chunk_end(
            normalized,
            start,
            target_end,
        )

        chunk = normalized[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(normalized):
            break

        next_start = max(
            end - overlap,
            start + 1,
        )

        start = next_start

    return chunks
