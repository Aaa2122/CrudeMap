from fastapi.testclient import TestClient

from app.main import app


def test_status_disabled_without_key():
    with TestClient(app) as client:
        res = client.get("/api/v1/ais/status")
        assert res.status_code == 200
        body = res.json()
        assert body["enabled"] is False
        assert body["vessel_count"] == 0
