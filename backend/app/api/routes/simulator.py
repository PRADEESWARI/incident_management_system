from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from app.core.security import get_current_user
from app.schemas.signal import SignalIngest, SignalType, SignalSeverity
from app.services.signal_service import ingest_signal
from app.core.logging import logger
import asyncio
import random
from datetime import datetime, timezone

router = APIRouter(prefix="/simulator", tags=["Chaos Simulator"])

SCENARIOS = {
    "api_down": {
        "signal_type": SignalType.API_500_ERROR,
        "severity": SignalSeverity.HIGH,
        "component_name": "payment-api",
        "message": "HTTP 500 Internal Server Error - Service unavailable",
    },
    "db_down": {
        "signal_type": SignalType.DB_DOWN,
        "severity": SignalSeverity.CRITICAL,
        "component_name": "primary-postgres",
        "message": "Database connection refused - Primary node unreachable",
    },
    "db_slow_query": {
        "signal_type": SignalType.DB_SLOW_QUERY,
        "severity": SignalSeverity.MEDIUM,
        "component_name": "analytics-db",
        "message": "Query execution time exceeded 30s threshold",
    },
    "queue_lag": {
        "signal_type": SignalType.QUEUE_LAG_HIGH,
        "severity": SignalSeverity.MEDIUM,
        "component_name": "order-processing-queue",
        "message": "Consumer lag: 50,000 messages behind",
    },
    "cache_failure": {
        "signal_type": SignalType.CACHE_NODE_DOWN,
        "severity": SignalSeverity.HIGH,
        "component_name": "redis-cluster-node-2",
        "message": "Redis node failure detected - replication interrupted",
    },
    "memory_full": {
        "signal_type": SignalType.SERVER_RAM_FULL,
        "severity": SignalSeverity.HIGH,
        "component_name": "app-server-03",
        "message": "Memory usage at 98% - OOM killer triggered",
    },
    "cpu_spike": {
        "signal_type": SignalType.SERVER_CPU_HIGH,
        "severity": SignalSeverity.MEDIUM,
        "component_name": "worker-node-07",
        "message": "CPU usage at 95% for 5 consecutive minutes",
    },
    "security_attack": {
        "signal_type": SignalType.SECURITY_BRUTE_FORCE,
        "severity": SignalSeverity.CRITICAL,
        "component_name": "auth-service",
        "message": "Brute force attack detected: 10,000 failed logins in 60 seconds",
    },
    "ssl_expiry": {
        "signal_type": SignalType.SECURITY_SSL_EXPIRY,
        "severity": SignalSeverity.MEDIUM,
        "component_name": "api-gateway",
        "message": "SSL certificate expires in 3 days",
    },
    "latency_spike": {
        "signal_type": SignalType.API_LATENCY_SPIKE,
        "severity": SignalSeverity.HIGH,
        "component_name": "checkout-api",
        "message": "P99 latency spiked to 8500ms (threshold: 2000ms)",
    },
    "consumer_crash": {
        "signal_type": SignalType.QUEUE_CONSUMER_DEAD,
        "severity": SignalSeverity.HIGH,
        "component_name": "notification-consumer",
        "message": "Consumer process crashed - no heartbeat for 120 seconds",
    },
    "disk_full": {
        "signal_type": SignalType.SERVER_DISK_FULL,
        "severity": SignalSeverity.HIGH,
        "component_name": "log-server-01",
        "message": "Disk usage at 99% on /var/log partition",
    },
    "nosql_failure": {
        "signal_type": SignalType.NOSQL_NODE_FAILURE,
        "severity": SignalSeverity.HIGH,
        "component_name": "mongodb-shard-3",
        "message": "MongoDB shard node failure - data unavailable",
    },
}


class SimulateRequest(BaseModel):
    scenario: str
    component_id: Optional[str] = None
    component_name: Optional[str] = None
    severity: Optional[str] = None
    count: int = 1
    environment: str = "production"


class LoadTestRequest(BaseModel):
    signals_per_second: int = 100
    duration_seconds: int = 10
    scenario: str = "api_down"


@router.get("/scenarios")
async def list_scenarios(current_user: dict = Depends(get_current_user)):
    return {
        "scenarios": [
            {"id": k, "name": k.replace("_", " ").title(), **{
                "signal_type": v["signal_type"].value,
                "severity": v["severity"].value,
                "component": v["component_name"],
            }}
            for k, v in SCENARIOS.items()
        ]
    }


@router.post("/trigger")
async def trigger_scenario(
    req: SimulateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    if req.scenario not in SCENARIOS and req.scenario != "random" and req.scenario != "cascade":
        return {"error": f"Unknown scenario: {req.scenario}"}

    results = []
    for i in range(min(req.count, 100)):
        if req.scenario == "random":
            scenario_key = random.choice(list(SCENARIOS.keys()))
        elif req.scenario == "cascade":
            # Cascading outage: DB down causes API failures
            scenario_keys = ["db_down", "api_down", "queue_lag", "cache_failure"]
            scenario_key = scenario_keys[i % len(scenario_keys)]
        else:
            scenario_key = req.scenario

        template = SCENARIOS[scenario_key]
        # Add timestamp suffix to component_id so each trigger creates a FRESH incident
        # instead of being debounced into an existing one
        import time as _time
        unique_suffix = str(int(_time.time() * 1000))[-5:]
        base_component = req.component_id or template["component_name"].lower().replace(" ", "-").replace("_", "-")
        component_id = f"{base_component}-{unique_suffix}"
        component_name = req.component_name or template["component_name"]

        sev_map = {
            "CRITICAL": SignalSeverity.CRITICAL,
            "HIGH": SignalSeverity.HIGH,
            "MEDIUM": SignalSeverity.MEDIUM,
            "LOW": SignalSeverity.LOW,
        }
        severity = sev_map.get(req.severity, template["severity"]) if req.severity else template["severity"]

        signal = SignalIngest(
            signal_type=template["signal_type"],
            component_id=component_id,
            component_name=component_name,
            severity=severity,
            message=template["message"],
            source="chaos-simulator",
            environment=req.environment,
            metadata={"simulated": True, "scenario": scenario_key},
        )
        try:
            result = await ingest_signal(signal)
            results.append({
                "scenario": scenario_key,
                "signal_id": result.signal_id,
                "incident_id": result.incident_id,
                "created": result.incident_created,
            })
        except Exception as e:
            results.append({"scenario": scenario_key, "error": str(e)})

    return {"triggered": len(results), "results": results}


@router.post("/load-test")
async def start_load_test(
    req: LoadTestRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Start a background load test."""
    background_tasks.add_task(_run_load_test, req)
    return {
        "message": f"Load test started: {req.signals_per_second} signals/sec for {req.duration_seconds}s",
        "total_signals": req.signals_per_second * req.duration_seconds,
    }


async def _run_load_test(req: LoadTestRequest):
    template = SCENARIOS.get(req.scenario, SCENARIOS["api_down"])
    total = req.signals_per_second * req.duration_seconds
    batch_size = min(req.signals_per_second, 50)
    batches = total // batch_size

    for batch in range(batches):
        tasks = []
        for _ in range(batch_size):
            signal = SignalIngest(
                signal_type=template["signal_type"],
                component_id=f"load-test-{random.randint(1, 10)}",
                component_name=f"LoadTest-Service-{random.randint(1, 10)}",
                severity=template["severity"],
                message=template["message"],
                source="load-test",
                environment="staging",
                metadata={"load_test": True},
            )
            tasks.append(ingest_signal(signal))
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.sleep(1.0)

    logger.info("Load test completed", total=total)


@router.post("/duplicate-storm")
async def trigger_duplicate_storm(
    component_id: str = "payment-api",
    count: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Trigger a duplicate alert storm to test debouncing."""
    tasks = []
    for _ in range(min(count, 200)):
        signal = SignalIngest(
            signal_type=SignalType.API_500_ERROR,
            component_id=component_id,
            component_name="Payment API",
            severity=SignalSeverity.HIGH,
            message="HTTP 500 - Duplicate storm test",
            source="chaos-simulator",
            metadata={"storm_test": True},
        )
        tasks.append(ingest_signal(signal))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    debounced = sum(1 for r in results if not isinstance(r, Exception) and r.debounced)
    created = sum(1 for r in results if not isinstance(r, Exception) and r.incident_created)

    return {
        "total_signals": count,
        "incidents_created": created,
        "debounced": debounced,
        "noise_reduction_pct": round(debounced / count * 100, 1) if count > 0 else 0,
    }
