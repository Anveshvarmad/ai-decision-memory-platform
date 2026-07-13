def test_root_endpoint(client):
    response = client.get("/")

    assert response.status_code == 200

    payload = response.json()

    assert "message" in payload
    assert "version" in payload
    assert payload["docs"] == "/docs"


def test_health_endpoint(client):
    response = client.get("/api/health")

    assert response.status_code == 200

    payload = response.json()

    assert payload["status"] in {
        "healthy",
        "ok",
    }


def test_openapi_endpoint(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200

    payload = response.json()

    assert "paths" in payload
    assert "/api/auth/login" in payload["paths"]
