from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from app.core.security import get_current_user
from app.schemas.signal import SignalIngest, SignalType, SignalSeverity
from app.services.signal_service import ingest_signal
from app.core.logging import logger
import asyncio
import random
import time
from datetime import datetime, timezone

router = APIRouter(prefix="/simulator", tags=["Chaos Simulator"])

SCENARIOS = {
    "api_down": {
        "signal_type": SignalType.API_500_ERROR,
        "severity": SignalSeverity.HIGH,
        "component_base": "payment-api",
        "component_name": "Payment API",
        "message": "HTTP 500 Internal Server Error — Service unavailable, error rate at 15%",
    },
    "db_down": {
        "signal_type": SignalType.DB_DOWN,
        "severity": SignalSeverity.CRITICAL,
        "component_base": "primary-postgres",
        "component_name": "Primary PostgreSQL",
        "message": "Database connection refused — Primary node unreachable on port 5432",
    },
    "db_slow_query": {
        "signal_type": SignalType.DB_SLOW_QUERY,
        "severity": SignalSeverity.MEDIUM,
        "component_base": "analytics-db",
        "component_name": "Analytics Database",
        "message": "Query execution time exceeded 30s threshold — full table scan detected",
    },
    "queue_lag": {
        "signal_type": SignalType.QUEUE_LAG_HIGH,
        "severity": SignalSeverity.MEDIUM,
        "component_base": "order-processing-queue",
        "component_name": "Order Processing Queue",
        "message": "Consumer lag: 50,000 messages behind — processing rate degraded",
    },
    "cache_failure": {
        "signal_type": SignalType.CACHE_NODE_DOWN,
        "severity": SignalSeverity.HIGH,
        "component_base": "redis-cluster-node-2",
        "component_name": "Redis Cluster Node 2",
        "message": "Redis node failure detected — replication interrupted, cache hit rate dropped to 40%",
    },
    "memory_full": {
        "signal_type": SignalType.SERVER_RAM_FULL,
        "severity": SignalSeverity.HIGH,
        "component_base": "app-server-03",
        "component_name": "App Server 03",
        "message": "Memory usage at 98% — OOM killer triggered, processes being terminated",
    },
    "cpu_spike": {
        "signal_type": SignalType.SERVER_CPU_HIGH,
        "severity": SignalSeverity.MEDIUM,
        "component_base": "worker-node-07",
        "component_name": "Worker Node 07",
        "message": "CPU usage at 95% for 5 consecutive minutes — system load average: 12.4",
    },
    "security_attack": {
        "signal_type": SignalType.SECURITY_BRUTE_FORCE,
        "severity": SignalSeverity.CRITICAL,
        "component_base": "auth-service",
        "component_name": "Auth Service",
        "message": "Brute force attack detected: 10,000 failed logins in 60 seconds from 3 IP ranges",
    },
    "ssl_expiry": {
        "signal_type": SignalType.SECURITY_SSL_EXPIRY,
        "severity": SignalSeverity.MEDIUM,
        "component_base": "api-gateway",
        "component_name": "API Gateway",
        "message": "SSL certificate expires in 3 days — auto-renewal failed, manual action required",
    },
    "latency_spike": {
        "signal_type": SignalType.API_LATENCY_SPIKE,
        "severity": SignalSeverity.HIGH,
        "component_base": "checkout-api",
        "component_name": "Checkout API",
        "message": "P99 latency spiked to 8500ms — normal baseline is 200ms, users experiencing timeouts",
    },
    "consumer_crash": {
        "signal_type": SignalType.QUEUE_CONSUMER_DEAD,
        "severity": SignalSeverity.HIGH,
        "component_base": "notification-consumer",
        "component_name": "Notification Consumer",
        "message": "Consumer process crashed — no heartbeat for 120 seconds, messages accumulating",
    },
    "disk_full": {
        "signal_type": SignalType.SERVER_DISK_FULL,
        "severity": SignalSeverity.HIGH,
        "component_base": "log-server-01",
        "component_name": "Log Server 01",
        "message": "Disk usage at 99% on /var/log partition — log rotation failed, new logs being dropped",
    },
    "nosql_failure": {
        "signal_type": SignalType.NOSQL_NODE_FAILURE,
        "severity": SignalSeverity.HIGH,
        "component_base": "mongodb-shard-3",
        "component_name": "MongoDB Shard 3",
        "message": "MongoDB shard node failure — data unavailable, read/write operations timing out",
    },
}


def _unique_id() -> str:
    """Generate a short unique suffix based on current timestamp."""
    return str(int(time.time() * 1000))[-6:]


class SimulateRequest(BaseModel):
    scenario: str
    component_id: Optional[str] = None
    component_name: Optional[str] = None
    severity: Optional[str] = None
    count: int = 1
    environment: str = "production"
    # If True, always create a fresh incident (unique component ID)
    # If False, group into existing incident for same component
    force_new: bool = True


class LoadTestRequest(BaseModel):
    signals_per_second: int = 100
    duration_seconds: int = 10
    scenario: str = "api_down"


@router.get("/scenarios")
async def list_scenarios(current_user: dict = Depends(get_current_user)):
    return {
        "scenarios": [
            {
                "id": k,
                "name": k.replace("_", " ").title(),
                "signal_type": v["signal_type"].value,
                "severity": v["severity"].value,
                "component": v["component_base"],
            }
            for k, v in SCENARIOS.items()
        ]
    }


@router.post("/trigger")
async def trigger_scenario(
    req: SimulateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger chaos scenarios.
    Uses STABLE component IDs so repeated triggers of the same scenario
    GROUP into the same incident (correct real-world behavior).
    First trigger creates the incident. Subsequent triggers add signals to it.
    """
    # Handle special scenarios
    if req.scenario == "cascade":
        return await _trigger_cascade(req)
    if req.scenario == "random":
        return await _trigger_random(req)

    if req.scenario not in SCENARIOS:
        return {"error": f"Unknown scenario: {req.scenario}. Available: {list(SCENARIOS.keys())}"}

    results = []
    for i in range(min(req.count, 100)):
        template = SCENARIOS[req.scenario]

        # Use STABLE component ID — same scenario always maps to same component.
        # First trigger creates the incident, subsequent triggers GROUP into it.
        component_id = req.component_id or template["component_base"]
        component_name = req.component_name or template["component_name"]

        sev_map = {
            "CRITICAL": SignalSeverity.CRITICAL,
            "HIGH": SignalSeverity.HIGH,
            "MEDIUM": SignalSeverity.MEDIUM,
            "LOW": SignalSeverity.LOW,
        }
        severity = sev_map.get(req.severity or "", template["severity"])

        signal = SignalIngest(
            signal_type=template["signal_type"],
            component_id=component_id,
            component_name=component_name,
            severity=severity,
            message=template["message"],
            source="chaos-simulator",
            environment=req.environment,
            metadata={"simulated": True, "scenario": req.scenario},
        )
        try:
            result = await ingest_signal(signal)
            results.append({
                "scenario": req.scenario,
                "signal_id": result.signal_id,
                "incident_id": result.incident_id,
                "created": result.incident_created,
                "component_id": component_id,
            })
        except Exception as e:
            results.append({"scenario": req.scenario, "error": str(e)})

    created_count = sum(1 for r in results if r.get("created"))
    return {
        "triggered": len(results),
        "incidents_created": created_count,
        "results": results,
    }


async def _trigger_cascade(req: SimulateRequest) -> dict:
    """
    Cascading outage: DB down → API errors → Queue lag → Cache failure.
    Each gets a unique ID so all 4 create fresh incidents.
    """
    cascade_scenarios = ["db_down", "api_down", "queue_lag", "cache_failure"]
    results = []
    uid = _unique_id()

    for scenario_key in cascade_scenarios:
        template = SCENARIOS[scenario_key]
        component_id = f"{template['component_base']}-cascade-{uid}"

        signal = SignalIngest(
            signal_type=template["signal_type"],
            component_id=component_id,
            component_name=f"{template['component_name']} (Cascade)",
            severity=template["severity"],
            message=f"[CASCADE] {template['message']}",
            source="chaos-simulator",
            environment=req.environment,
            metadata={"simulated": True, "scenario": "cascade", "cascade_id": uid},
        )
        try:
            result = await ingest_signal(signal)
            results.append({
                "scenario": scenario_key,
                "signal_id": result.signal_id,
                "incident_id": result.incident_id,
                "created": result.incident_created,
                "component_id": component_id,
            })
        except Exception as e:
            results.append({"scenario": scenario_key, "error": str(e)})

    created_count = sum(1 for r in results if r.get("created"))
    return {
        "triggered": len(results),
        "incidents_created": created_count,
        "results": results,
    }


async def _trigger_random(req: SimulateRequest) -> dict:
    """Trigger 5 random scenarios, each creating a fresh incident."""
    chosen = random.sample(list(SCENARIOS.keys()), min(5, len(SCENARIOS)))
    results = []
    uid = _unique_id()

    for scenario_key in chosen:
        template = SCENARIOS[scenario_key]
        component_id = f"{template['component_base']}-random-{uid}"

        signal = SignalIngest(
            signal_type=template["signal_type"],
            component_id=component_id,
            component_name=f"{template['component_name']} (Random)",
            severity=template["severity"],
            message=f"[RANDOM] {template['message']}",
            source="chaos-simulator",
            environment=req.environment,
            metadata={"simulated": True, "scenario": scenario_key, "random_id": uid},
        )
        try:
            result = await ingest_signal(signal)
            results.append({
                "scenario": scenario_key,
                "signal_id": result.signal_id,
                "incident_id": result.incident_id,
                "created": result.incident_created,
                "component_id": component_id,
            })
        except Exception as e:
            results.append({"scenario": scenario_key, "error": str(e)})

    created_count = sum(1 for r in results if r.get("created"))
    return {
        "triggered": len(results),
        "incidents_created": created_count,
        "results": results,
    }


@router.post("/load-test")
async def start_load_test(
    req: LoadTestRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Start a background load test."""
    background_tasks.add_task(_run_load_test, req)
    total = req.signals_per_second * req.duration_seconds
    return {
        "message": f"Load test started: {req.signals_per_second} signals/sec for {req.duration_seconds}s ({total} total signals)",
        "total_signals": total,
        "watch": "Dashboard → Signals/sec metric updates live",
    }


async def _run_load_test(req: LoadTestRequest):
    template = SCENARIOS.get(req.scenario, SCENARIOS["api_down"])
    total = req.signals_per_second * req.duration_seconds
    batch_size = min(req.signals_per_second, 50)
    batches = max(1, total // batch_size)
    uid = _unique_id()

    for batch in range(batches):
        tasks = []
        for j in range(batch_size):
            # Use 5 different component IDs so signals spread across 5 incidents
            component_num = (j % 5) + 1
            signal = SignalIngest(
                signal_type=template["signal_type"],
                component_id=f"load-test-{uid}-svc-{component_num}",
                component_name=f"Load Test Service {component_num}",
                severity=template["severity"],
                message=template["message"],
                source="load-test",
                environment="staging",
                metadata={"load_test": True, "batch": batch},
            )
            tasks.append(ingest_signal(signal))
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.sleep(1.0)

    logger.info("Load test completed", total=total)


@router.post("/duplicate-storm")
async def trigger_duplicate_storm(
    component_id: str = "debounce-test-service",
    count: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """
    Debounce engine test.
    Uses a STABLE component ID so all runs group into the same incident.
    First signal ever creates 1 incident. All subsequent signals (across all runs)
    group into that same incident — proving the grouping engine works correctly.
    """
    # Use stable component ID — same every run so signals always group
    stable_component_id = component_id  # default: "debounce-test-service"

    # Run signals sequentially so each one finds the previous result
    results = []
    for i in range(min(count, 200)):
        signal = SignalIngest(
            signal_type=SignalType.API_500_ERROR,
            component_id=stable_component_id,
            component_name="Debounce Test Service",
            severity=SignalSeverity.HIGH,
            message=f"Debounce engine test — all signals for this component group into one incident",
            source="chaos-simulator",
            metadata={"debounce_test": True, "signal_index": i},
        )
        try:
            result = await ingest_signal(signal)
            results.append(result)
        except Exception as e:
            logger.error("Debounce test signal failed", error=str(e))

    created = sum(1 for r in results if r.incident_created)
    grouped = sum(1 for r in results if not r.incident_created)
    errors = 0

    # Get the incident ID (same for all signals)
    incident_id = None
    for r in results:
        if r.incident_id:
            incident_id = r.incident_id
            break

    return {
        "component_id": stable_component_id,
        "total_signals": count,
        "incidents_created": created,
        "signals_grouped": grouped,
        "errors": errors,
        "incident_id": incident_id,
        "noise_reduction_pct": round(grouped / count * 100, 1) if count > 0 else 0,
        "result": f"{count} signals → {created} incident created, {grouped} signals grouped into existing incident",
    }
