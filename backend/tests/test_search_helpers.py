from app.services.search_service import (
    extract_exact_terms,
    normalize_exact_query,
)


def test_normalize_exact_query():
    assert (
        normalize_exact_query(
            "  MongoDB   Connection Pool "
        )
        == "mongodb connection pool"
    )


def test_extract_exact_technology_terms():
    terms = extract_exact_terms(
        "Why did we replace MongoDB with PostgreSQL?"
    )

    assert "mongodb" in terms
    assert "postgresql" in terms


def test_extract_identifiers():
    terms = extract_exact_terms(
        "Review AUTH-142 and PR #218"
    )

    assert "auth-142" in terms
    assert any(
        "218" in term
        for term in terms
    )


def test_extract_quoted_terms():
    terms = extract_exact_terms(
        'Find "connection pool exhaustion"'
    )

    assert (
        "connection pool exhaustion"
        in terms
    )
