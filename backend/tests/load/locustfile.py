"""
Load testing with Locust.
Run: locust -f tests/load/locustfile.py --host=http://localhost:8000
"""
from locust import HttpUser, task, between
import random
import json

SIGNAL_TYPES = [
    "API_500_ERROR", "API_TIMEOUT", "SERVER_CPU_HIGH",
    "DB_SLOW_QUERY", "CACHE_NODE_DOWN", "QUEUE_LAG_HIGH",
    "SECURITY_BRUTE_FORCE", "NOSQL_NODE_FAILURE",
]

COMPONENTS = [
    "payment-api", "checkout-api", "auth-service",
    "postgres-primary", "redis-cluster", "kafka-broker",
    "app-server-01", "app-server-02", "mongodb-shard-1",
]


class SignalIngestionUser(HttpUser):
    """Simulates high-throughput signal ingestion."""
    wait_time = between(0.001, 0.01)

    @task(10)
    def ingest_signal(self):
        payload = {
            "signal_type": random.choice(SIGNAL_TYPES),
            "component_id": random.choice(COMPONENTS),
            "component_name": random.choice(COMPONENTS).replace("-", " ").title(),
            "severity": random.choice(["HIGH", "MEDIUM", "CRITICAL"]),
            "message": f"Load test signal - {random.randint(1000, 9999)}",
            "source": "locust-load-test",
            "metadata": {"load_test": True, "iteration": random.randint(1, 10000)},
        }
        self.client.post(
            "/api/v1/signals",
            json=payload,
            headers={"X-API-Key": "signal-ingestion-api-key-2024"},
            name="/api/v1/signals",
        )

    @task(1)
    def check_health(self):
        self.client.get("/health", name="/health")


class DashboardUser(HttpUser):
    """Simulates dashboard users reading data."""
    wait_time = between(1, 5)
    token = None

    def on_start(self):
        resp = self.client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin123!",
        })
        if resp.status_code == 200:
            self.token = resp.json()["access_token"]

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(5)
    def get_dashboard(self):
        self.client.get("/api/v1/analytics/dashboard", headers=self.get_headers())

    @task(3)
    def list_incidents(self):
        self.client.get("/api/v1/incidents?page=1&page_size=20", headers=self.get_headers())

    @task(1)
    def get_service_health(self):
        self.client.get("/api/v1/analytics/service-health", headers=self.get_headers())
