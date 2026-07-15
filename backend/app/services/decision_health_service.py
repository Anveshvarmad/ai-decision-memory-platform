from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.decision import Decision
from app.schemas.decision_health import (
    DecisionHealthCounts,
    DecisionHealthIssue,
    DecisionHealthResponse,
)


ACTIVE_STATUSES = {
    "active",
    "approved",
    "accepted",
    "final",
    "implemented",
    "open",
    "published",
}

REVERSED_STATUSES = {
    "reversed",
    "rejected",
    "withdrawn",
    "superseded",
    "deprecated",
    "rolled_back",
    "rollback",
    "cancelled",
    "canceled",
}

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "decision",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "use",
    "we",
    "with",
}

POSITIVE_CUES = {
    "adopt",
    "approve",
    "enable",
    "implement",
    "migrate",
    "proceed",
    "select",
    "use",
}

NEGATIVE_CUES = {
    "avoid",
    "block",
    "disable",
    "do not",
    "dont",
    "prohibit",
    "reject",
    "rollback",
    "stop",
}


def get_value(
    instance: Any,
    *names: str,
    default: Any = None,
) -> Any:
    for name in names:
        if not hasattr(instance, name):
            continue

        value = getattr(instance, name)

        if value is not None:
            return value

    return default


def string_value(value: Any) -> str:
    if value is None:
        return ""

    enum_value = getattr(value, "value", None)

    if enum_value is not None:
        return str(enum_value)

    return str(value)


def decision_id(decision: Any) -> str:
    return string_value(
        get_value(
            decision,
            "id",
            "decision_id",
            default="unknown",
        )
    )


def decision_title(decision: Any) -> str:
    value = get_value(
        decision,
        "title",
        "name",
        "summary",
        "decision",
        default="Untitled decision",
    )

    return string_value(value).strip() or "Untitled decision"


def decision_text(decision: Any) -> str:
    values = [
        get_value(
            decision,
            "title",
            "name",
            default="",
        ),
        get_value(
            decision,
            "summary",
            "description",
            "content",
            "decision_text",
            "rationale",
            default="",
        ),
    ]

    return " ".join(
        string_value(value)
        for value in values
        if value is not None
    ).strip()


def decision_status(decision: Any) -> str:
    return string_value(
        get_value(
            decision,
            "status",
            "state",
            default="unknown",
        )
    ).strip().lower()


def decision_datetime(
    decision: Any,
) -> datetime | None:
    value = get_value(
        decision,
        "updated_at",
        "decided_at",
        "approved_at",
        "created_at",
    )

    if not isinstance(value, datetime):
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def decision_age_days(
    decision: Any,
    now: datetime,
) -> int | None:
    timestamp = decision_datetime(decision)

    if timestamp is None:
        return None

    return max(0, (now - timestamp).days)


def evidence_count(decision: Any) -> int:
    explicit = get_value(
        decision,
        "evidence_count",
        "citation_count",
        "source_count",
        "supporting_source_count",
    )

    if explicit is not None:
        try:
            return max(0, int(explicit))
        except (TypeError, ValueError):
            pass

    relationship_names = [
        "citations",
        "evidence",
        "sources",
        "source_chunks",
        "supporting_documents",
        "supporting_evidence",
    ]

    for name in relationship_names:
        try:
            relationship = getattr(decision, name, None)

            if relationship is not None:
                return len(relationship)
        except Exception:
            continue

    identifier_names = [
        "document_id",
        "source_document_id",
        "chunk_id",
        "source_chunk_id",
    ]

    for name in identifier_names:
        if getattr(decision, name, None) is not None:
            return 1

    text_names = [
        "source_quote",
        "evidence_text",
        "citation",
        "source_reference",
    ]

    for name in text_names:
        value = getattr(decision, name, None)

        if isinstance(value, str) and value.strip():
            return 1

    return 0


def is_reversed(decision: Any) -> bool:
    if decision_status(decision) in REVERSED_STATUSES:
        return True

    for name in [
        "superseded_by_id",
        "reversed_by_id",
        "replacement_decision_id",
    ]:
        if getattr(decision, name, None) is not None:
            return True

    return bool(
        get_value(
            decision,
            "is_reversed",
            "is_superseded",
            default=False,
        )
    )


def has_explicit_conflict(decision: Any) -> bool:
    if bool(
        get_value(
            decision,
            "has_conflict",
            "is_conflicting",
            default=False,
        )
    ):
        return True

    count = get_value(
        decision,
        "conflict_count",
        default=0,
    )

    try:
        if int(count) > 0:
            return True
    except (TypeError, ValueError):
        pass

    return "conflict" in decision_status(decision)


def normalized_tokens(text: str) -> set[str]:
    tokens = re.findall(
        r"[a-z0-9]+",
        text.lower(),
    )

    return {
        token
        for token in tokens
        if token not in STOP_WORDS
        and len(token) > 2
    }


def subject_key(decision: Any) -> str:
    tokens = sorted(
        normalized_tokens(
            decision_text(decision)
        )
    )

    return " ".join(tokens[:12])


def direction(decision: Any) -> int:
    text = decision_text(decision).lower()

    positive = any(
        cue in text
        for cue in POSITIVE_CUES
    )

    negative = any(
        cue in text
        for cue in NEGATIVE_CUES
    )

    if positive and not negative:
        return 1

    if negative and not positive:
        return -1

    return 0


def heuristic_conflict_ids(
    decisions: list[Any],
) -> set[str]:
    if len(decisions) > 250:
        return set()

    prepared = [
        (
            decision,
            normalized_tokens(
                decision_text(decision)
            ),
            direction(decision),
        )
        for decision in decisions
    ]

    conflicts: set[str] = set()

    for index, (
        left,
        left_tokens,
        left_direction,
    ) in enumerate(prepared):
        if len(left_tokens) < 2:
            continue

        if left_direction == 0:
            continue

        for (
            right,
            right_tokens,
            right_direction,
        ) in prepared[index + 1:]:
            if len(right_tokens) < 2:
                continue

            if right_direction == 0:
                continue

            if left_direction == right_direction:
                continue

            union = left_tokens | right_tokens

            if not union:
                continue

            similarity = (
                len(left_tokens & right_tokens)
                / len(union)
            )

            if similarity < 0.65:
                continue

            conflicts.add(decision_id(left))
            conflicts.add(decision_id(right))

    return conflicts


def calculate_health_score(
    *,
    total: int,
    stale: int,
    missing_evidence: int,
    conflicts: int,
    reversed_count: int,
    frequent_reversals: int,
) -> int:
    if total <= 0:
        return 100

    score = 100.0
    score -= min(20.0, stale / total * 20.0)
    score -= min(
        35.0,
        missing_evidence / total * 35.0,
    )
    score -= min(
        25.0,
        conflicts / total * 25.0,
    )
    score -= min(
        15.0,
        reversed_count / total * 15.0,
    )
    score -= min(
        5.0,
        frequent_reversals / total * 5.0,
    )

    return max(0, min(100, round(score)))


def grade_for_score(score: int) -> str:
    if score >= 90:
        return "A"

    if score >= 80:
        return "B"

    if score >= 70:
        return "C"

    if score >= 60:
        return "D"

    return "F"


def workspace_column() -> Any:
    for name in [
        "workspace_id",
        "organization_id",
        "team_id",
    ]:
        column = getattr(Decision, name, None)

        if column is not None:
            return column

    raise RuntimeError(
        "The Decision model does not contain "
        "workspace_id, organization_id, or team_id."
    )


def recommendations(
    counts: DecisionHealthCounts,
    total: int,
) -> list[str]:
    if total == 0:
        return [
            "Upload documents and approve extracted "
            "decisions to begin health monitoring."
        ]

    results: list[str] = []

    if counts.missing_evidence:
        results.append(
            f"Attach supporting evidence to "
            f"{counts.missing_evidence} decision records."
        )

    if counts.stale:
        results.append(
            f"Review {counts.stale} stale decisions "
            f"and confirm whether they remain valid."
        )

    if counts.conflicts:
        results.append(
            f"Resolve or supersede "
            f"{counts.conflicts} conflicting decisions."
        )

    if counts.reversed:
        results.append(
            f"Document reversal rationale for "
            f"{counts.reversed} reversed decisions."
        )

    if counts.frequent_reversals:
        results.append(
            "Investigate repeatedly reversed subjects "
            "for unclear ownership or unstable requirements."
        )

    if not results:
        results.append(
            "Decision records are healthy. Continue "
            "periodic evidence and freshness reviews."
        )

    return results


def build_decision_health(
    db: Session,
    workspace_id: str,
    stale_after_days: int = 180,
) -> DecisionHealthResponse:
    stale_after_days = max(
        1,
        min(int(stale_after_days), 3650),
    )

    decisions = (
        db.query(Decision)
        .filter(
            workspace_column() == workspace_id
        )
        .all()
    )

    now = datetime.now(timezone.utc)

    detected_conflicts = heuristic_conflict_ids(
        decisions
    )

    groups: dict[str, list[Any]] = defaultdict(list)

    for decision in decisions:
        key = subject_key(decision)

        if key:
            groups[key].append(decision)

    frequent_reversal_ids: set[str] = set()

    for group in groups.values():
        reversed_items = [
            decision
            for decision in group
            if is_reversed(decision)
        ]

        if len(reversed_items) >= 2:
            frequent_reversal_ids.update(
                decision_id(decision)
                for decision in group
            )

    issues: list[DecisionHealthIssue] = []
    affected_ids: set[str] = set()

    stale_count = 0
    evidence_count_missing = 0
    conflict_count = 0
    reversed_count = 0
    frequent_reversal_count = 0

    for decision in decisions:
        identifier = decision_id(decision)
        title = decision_title(decision)
        status = decision_status(decision)
        age_days = decision_age_days(
            decision,
            now,
        )
        sources = evidence_count(decision)
        timestamp = decision_datetime(decision)

        stale = (
            age_days is not None
            and age_days > stale_after_days
            and (
                status in ACTIVE_STATUSES
                or status == "unknown"
            )
        )

        if stale:
            stale_count += 1
            affected_ids.add(identifier)

            issues.append(
                DecisionHealthIssue(
                    decision_id=identifier,
                    title=title,
                    issue_type="stale",
                    severity=(
                        "high"
                        if age_days > stale_after_days * 2
                        else "medium"
                    ),
                    summary=(
                        f"This decision has not been "
                        f"updated for {age_days} days."
                    ),
                    status=status,
                    age_days=age_days,
                    evidence_count=sources,
                    updated_at=timestamp,
                )
            )

        if sources == 0:
            evidence_count_missing += 1
            affected_ids.add(identifier)

            issues.append(
                DecisionHealthIssue(
                    decision_id=identifier,
                    title=title,
                    issue_type="missing_evidence",
                    severity="high",
                    summary=(
                        "No document, citation, source chunk, "
                        "or evidence reference was found."
                    ),
                    status=status,
                    age_days=age_days,
                    evidence_count=0,
                    updated_at=timestamp,
                )
            )

        conflicting = (
            has_explicit_conflict(decision)
            or identifier in detected_conflicts
        )

        if conflicting:
            conflict_count += 1
            affected_ids.add(identifier)

            issues.append(
                DecisionHealthIssue(
                    decision_id=identifier,
                    title=title,
                    issue_type="conflict",
                    severity="critical",
                    summary=(
                        "This decision conflicts with another "
                        "decision concerning the same subject."
                    ),
                    status=status,
                    age_days=age_days,
                    evidence_count=sources,
                    updated_at=timestamp,
                )
            )

        if is_reversed(decision):
            reversed_count += 1
            affected_ids.add(identifier)

            issues.append(
                DecisionHealthIssue(
                    decision_id=identifier,
                    title=title,
                    issue_type="reversed",
                    severity="medium",
                    summary=(
                        "This decision was reversed, withdrawn, "
                        "deprecated, or superseded."
                    ),
                    status=status,
                    age_days=age_days,
                    evidence_count=sources,
                    updated_at=timestamp,
                )
            )

        if identifier in frequent_reversal_ids:
            frequent_reversal_count += 1
            affected_ids.add(identifier)

            issues.append(
                DecisionHealthIssue(
                    decision_id=identifier,
                    title=title,
                    issue_type="frequent_reversal",
                    severity="high",
                    summary=(
                        "Multiple decisions covering this subject "
                        "were reversed or superseded."
                    ),
                    status=status,
                    age_days=age_days,
                    evidence_count=sources,
                    updated_at=timestamp,
                )
            )

    counts = DecisionHealthCounts(
        stale=stale_count,
        missing_evidence=evidence_count_missing,
        conflicts=conflict_count,
        reversed=reversed_count,
        frequent_reversals=frequent_reversal_count,
    )

    score = calculate_health_score(
        total=len(decisions),
        stale=stale_count,
        missing_evidence=evidence_count_missing,
        conflicts=conflict_count,
        reversed_count=reversed_count,
        frequent_reversals=frequent_reversal_count,
    )

    severity_order = {
        "critical": 0,
        "high": 1,
        "medium": 2,
        "low": 3,
    }

    issues.sort(
        key=lambda issue: (
            severity_order[issue.severity],
            -(issue.age_days or 0),
            issue.title.lower(),
        )
    )

    return DecisionHealthResponse(
        workspace_id=str(workspace_id),
        generated_at=now,
        stale_after_days=stale_after_days,
        health_score=score,
        grade=grade_for_score(score),
        total_decisions=len(decisions),
        healthy_decisions=max(
            0,
            len(decisions) - len(affected_ids),
        ),
        decisions_needing_review=len(affected_ids),
        counts=counts,
        issues=issues,
        recommendations=recommendations(
            counts,
            len(decisions),
        ),
    )
