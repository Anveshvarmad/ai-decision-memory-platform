from app.services.graph_service import (
    infer_entity_type,
    normalize_name,
)


def test_normalize_name():
    assert (
        normalize_name("  PostgreSQL   Database ")
        == "postgresql database"
    )


def test_infer_technology_type():
    assert (
        infer_entity_type("PostgreSQL")
        == "technology"
    )

    assert (
        infer_entity_type("MongoDB")
        == "technology"
    )


def test_infer_service_type():
    assert (
        infer_entity_type(
            "Order Management Service"
        )
        == "service"
    )


def test_infer_incident_type():
    assert (
        infer_entity_type(
            "March 4 Production Incident"
        )
        == "incident"
    )


def test_infer_default_type():
    assert (
        infer_entity_type(
            "Customer Reporting"
        )
        == "concept"
    )
