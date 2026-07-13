import re

from app.schemas.decision_query import DecisionQueryClassification


QUERY_PATTERNS: dict[str, list[str]] = {
    "why": [
        r"\bwhy\b",
        r"\breason\b",
        r"\bmotivat",
        r"\bwhat led to\b",
        r"\bwhy did\b",
    ],
    "who": [
        r"\bwho\b",
        r"\bapproved\b",
        r"\bowner\b",
        r"\bresponsible\b",
        r"\bparticipant",
    ],
    "when": [
        r"\bwhen\b",
        r"\bdate\b",
        r"\btimeline\b",
        r"\bchronolog",
        r"\bhow long\b",
    ],
    "alternatives": [
        r"\balternative",
        r"\boption",
        r"\bconsidered\b",
        r"\brejected\b",
        r"\binstead of\b",
    ],
    "status": [
        r"\bstatus\b",
        r"\bapproved\b",
        r"\brejected\b",
        r"\bcandidate\b",
        r"\bcurrent state\b",
        r"\bstill valid\b",
    ],
    "impact": [
        r"\bimpact\b",
        r"\baffected\b",
        r"\bresult\b",
        r"\bconsequence",
        r"\bchanged\b",
    ],
    "conflict": [
        r"\bconflict",
        r"\bcontradict",
        r"\binconsistent\b",
        r"\bsuperseded\b",
        r"\breplaced decision\b",
    ],
    "relationship": [
        r"\brelated\b",
        r"\bconnected\b",
        r"\bdependency\b",
        r"\bservice\b",
        r"\btechnology\b",
        r"\bincident\b",
    ],
}


def classify_decision_query(
    query: str,
) -> DecisionQueryClassification:
    normalized = query.strip().lower()

    scores: dict[str, int] = {}
    matched_terms: dict[str, list[str]] = {}

    for query_type, patterns in QUERY_PATTERNS.items():
        scores[query_type] = 0
        matched_terms[query_type] = []

        for pattern in patterns:
            match = re.search(pattern, normalized)

            if match:
                scores[query_type] += 1
                matched_terms[query_type].append(
                    match.group(0)
                )

    best_type = max(
        scores,
        key=scores.get,
    )

    best_score = scores[best_type]

    if best_score == 0:
        return DecisionQueryClassification(
            query_type="general",
            confidence=0.5,
            matched_terms=[],
        )

    total_matches = sum(scores.values())

    confidence = min(
        0.99,
        0.6 + (
            best_score / max(total_matches, 1)
        ) * 0.35,
    )

    return DecisionQueryClassification(
        query_type=best_type,
        confidence=round(confidence, 4),
        matched_terms=matched_terms[best_type],
    )
