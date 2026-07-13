from app.schemas.context import (
    CitationCoverage,
    ClaimCitationGroup,
    DecisionReasoningResult,
    RankedContextItem,
    ReasoningCitation,
)


def build_citation(
    item: RankedContextItem,
    citation_number: int,
) -> ReasoningCitation:
    excerpt = item.content[:600]

    if len(item.content) > 600:
        excerpt += "..."

    return ReasoningCitation(
        citation_number=citation_number,
        source_id=item.source_id,
        source_type=item.source_type,
        title=item.title,
        document_id=item.document_id,
        chunk_id=item.chunk_id,
        decision_id=item.decision_id,
        document_name=item.metadata.get(
            "document_name"
        ),
        page_number=item.metadata.get(
            "page_number"
        ),
        section_title=item.metadata.get(
            "section_title"
        ),
        excerpt=excerpt,
        score=item.score,
    )


def build_claim_citation_groups(
    result: DecisionReasoningResult,
    ranked_items: list[RankedContextItem],
) -> tuple[
    list[ClaimCitationGroup],
    CitationCoverage,
]:
    item_map = {
        item.source_id: item
        for item in ranked_items
    }

    groups: list[ClaimCitationGroup] = []

    claim_sets = [
        ("reason", result.reason_claims),
        (
            "alternative",
            result.alternative_claims,
        ),
        (
            "stakeholder",
            result.stakeholder_claims,
        ),
        ("risk", result.risk_claims),
        ("impact", result.impact_claims),
        (
            "uncertainty",
            result.uncertainty_claims,
        ),
    ]

    total_claims = 0
    supported_claims = 0

    for claim_type, claims in claim_sets:
        for index, claim in enumerate(claims):
            total_claims += 1

            citations: list[
                ReasoningCitation
            ] = []

            for source_id in claim.source_ids:
                item = item_map.get(source_id)

                if item is None:
                    continue

                citations.append(
                    build_citation(
                        item=item,
                        citation_number=(
                            len(citations) + 1
                        ),
                    )
                )

            supported = bool(citations)

            if supported:
                supported_claims += 1

            groups.append(
                ClaimCitationGroup(
                    claim_type=claim_type,
                    claim_index=index,
                    claim_text=claim.text,
                    supported=supported,
                    citations=citations,
                )
            )

    unsupported_claims = (
        total_claims - supported_claims
    )

    coverage_ratio = (
        supported_claims / total_claims
        if total_claims
        else 1.0
    )

    coverage = CitationCoverage(
        total_claims=total_claims,
        supported_claims=supported_claims,
        unsupported_claims=unsupported_claims,
        coverage_ratio=round(
            coverage_ratio,
            4,
        ),
    )

    return groups, coverage
