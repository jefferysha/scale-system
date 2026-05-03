"""Health 端点烟雾测试."""
from fastapi.testclient import TestClient

from scale_api.main import app


def test_health_endpoint_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "scale-api"}
