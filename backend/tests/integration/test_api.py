"""Integration tests for the IMS API."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE_URL = "http://test"


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/health")
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data
        assert "services" in data


@pytest.mark.anyio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert data["name"] == "Incident Management System"


@pytest.mark.anyio
async def test_signal_requires_api_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.post("/api/v1/signals", json={
            "signal_type": "API_500_ERROR",
            "component_id": "test-api",
            "component_name": "Test API",
            "severity": "HIGH",
            "message": "Test signal",
        })
        assert response.status_code == 401


@pytest.mark.anyio
async def test_incidents_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/api/v1/incidents")
        assert response.status_code == 401


@pytest.mark.anyio
async def test_openapi_docs():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/api/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data
