#!/usr/bin/env python3
"""
Seed script to generate sample signals via the API.
Usage: python scripts/seed_signals.py --url http://localhost:8000 --count 100
"""
import asyncio
import aiohttp
import random
import argparse
from datetime import datetime, timezone

API_KEY = "signal-ingestion-api-key-2024"

SIGNALS = [
    {"signal_type": "API_500_ERROR", "component_id": "payment-api", "component_name": "Payment API", "severity": "HIGH", "message": "HTTP 500 error rate at 8%"},
    {"signal_type": "DB_DOWN", "component_id": "postgres-primary", "component_name": "Primary PostgreSQL", "severity": "CRITICAL", "message": "Database connection refused"},
    {"signal_type": "SERVER_CPU_HIGH", "component_id": "app-server-03", "component_name": "App Server 03", "severity": "MEDIUM", "message": "CPU at 94%"},
    {"signal_type": "CACHE_NODE_DOWN", "component_id": "redis-node-2", "component_name": "Redis Node 2", "severity": "HIGH", "message": "Redis node unreachable"},
    {"signal_type": "QUEUE_LAG_HIGH", "component_id": "order-queue", "component_name": "Order Queue", "severity": "MEDIUM", "message": "Consumer lag: 45,000 messages"},
    {"signal_type": "SECURITY_BRUTE_FORCE", "component_id": "auth-service", "component_name": "Auth Service", "severity": "CRITICAL", "message": "Brute force detected"},
    {"signal_type": "DB_SLOW_QUERY", "component_id": "analytics-db", "component_name": "Analytics DB", "severity": "MEDIUM", "message": "Query took 45 seconds"},
    {"signal_type": "NOSQL_NODE_FAILURE", "component_id": "mongodb-shard-1", "component_name": "MongoDB Shard 1", "severity": "HIGH", "message": "Shard node failure"},
    {"signal_type": "SERVER_DISK_FULL", "component_id": "log-server-01", "component_name": "Log Server 01", "severity": "HIGH", "message": "Disk at 99%"},
    {"signal_type": "SECURITY_SSL_EXPIRY", "component_id": "api-gateway", "component_name": "API Gateway", "severity": "MEDIUM", "message": "SSL expires in 3 days"},
]


async def send_signal(session: aiohttp.ClientSession, url: str, signal: dict):
    try:
        async with session.post(
            f"{url}/api/v1/signals",
            json=signal,
            headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
        ) as resp:
            if resp.status == 202:
                data = await resp.json()
                return True, data.get("incident_id")
            return False, None
    except Exception as e:
        return False, str(e)


async def main(url: str, count: int, concurrency: int = 10):
    print(f"Seeding {count} signals to {url}...")
    success = 0
    failed = 0

    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(count):
            signal = random.choice(SIGNALS).copy()
            signal["metadata"] = {"seed": True, "index": i}
            tasks.append(send_signal(session, url, signal))

        # Process in batches
        for i in range(0, len(tasks), concurrency):
            batch = tasks[i:i + concurrency]
            results = await asyncio.gather(*batch)
            for ok, _ in results:
                if ok:
                    success += 1
                else:
                    failed += 1

            if (i + concurrency) % 50 == 0:
                print(f"  Progress: {min(i + concurrency, count)}/{count}")

    print(f"\nDone! Success: {success}, Failed: {failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    args = parser.parse_args()
    asyncio.run(main(args.url, args.count, args.concurrency))
