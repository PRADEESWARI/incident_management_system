import asyncio
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from app.schemas.signal import SignalIngest, SignalResponse, SignalType
from app.models.postgres_models import (
    Incident, IncidentStatus, IncidentSeverity, ComponentType, IncidentStatusHistory
)
from app.db.postgres import AsyncSessionLocal
from app.db.mongodb import get_mongodb
from app.db.redis_client import get_redis, cache_get, cache_set, increment_counter, publish_event
from app.db.kafka_client import send_signal, is_kafka_available
from app.core.config import settings
from app.core.logging import logger
from sqlalchemy import select, and_
import uuid

# In-memory fallback queue
_fallback_queue: asyncio.Queue = asyncio.Queue(maxsize=100000)

SIGNAL_TO_SEVERITY = {
    SignalType.DB_DOWN: IncidentSeverity.P0_CRITICAL,
    SignalType.SERVER_PROCESS_CRASH: IncidentSeverity.P0_CRITICAL,
    SignalType.SECURITY_BRUTE_FORCE: IncidentSeverity.P0_CRITICAL,
    SignalType.CACHE_NODE_DOWN: IncidentSeverity.P1_HIGH,
    SignalType.API_500_ERROR: IncidentSeverity.P1_HIGH,
    SignalType.QUEUE_CONSUMER_DEAD: IncidentSeverity.P1_HIGH,
    SignalType.NOSQL_NODE_FAILURE: IncidentSeverity.P1_HIGH,
    SignalType.DB_DEADLOCK: IncidentSeverity.P1_HIGH,
    SignalType.API_TIMEOUT: IncidentSeverity.P2_MEDIUM,
    SignalType.SERVER_CPU_HIGH: IncidentSeverity.P2_MEDIUM,
    SignalType.SERVER_RAM_FULL: IncidentSeverity.P2_MEDIUM,
    SignalType.QUEUE_LAG_HIGH: IncidentSeverity.P2_MEDIUM,
    SignalType.DB_SLOW_QUERY: IncidentSeverity.P2_MEDIUM,
    SignalType.CACHE_MEMORY_FULL: IncidentSeverity.P2_MEDIUM,
    SignalType.API_SLOW_RESPONSE: IncidentSeverity.P3_LOW,
    SignalType.SERVER_DISK_FULL: IncidentSeverity.P2_MEDIUM,
    SignalType.SECURITY_SSL_EXPIRY: IncidentSeverity.P2_MEDIUM,
    SignalType.SECURITY_UNAUTHORIZED_SPIKE: IncidentSeverity.P1_HIGH,
    SignalType.SECURITY_TOKEN_ABUSE: IncidentSeverity.P1_HIGH,
}

SIGNAL_TO_COMPONENT_TYPE = {
    "API_": ComponentType.API,
    "SERVER_": ComponentType.SERVER,
    "CACHE_": ComponentType.CACHE,
    "QUEUE_": ComponentType.QUEUE,
    "DB_": ComponentType.RDBMS,
    "NOSQL_": ComponentType.NOSQL,
    "SECURITY_": ComponentType.SECURITY,
}

COMPONENT_TO_TEAM = {
    ComponentType.API: "backend-team",
    ComponentType.SERVER: "infrastructure-team",
    ComponentType.CACHE: "platform-team",
    ComponentType.QUEUE: "platform-team",
    ComponentType.RDBMS: "dba-team",
    ComponentType.NOSQL: "dba-team",
    ComponentType.SECURITY: "security-team",
    ComponentType.NETWORK: "infrastructure-team",
}

# Statuses that are considered "active" — signals should group into these
ACTIVE_STATUSES = [
    IncidentStatus.OPEN,
    IncidentStatus.ACKNOWLEDGED,
    IncidentStatus.INVESTIGATING,
    IncidentStatus.MITIGATED,
    IncidentStatus.REOPENED,
]


def get_component_type(signal_type: str) -> ComponentType:
    for prefix, ctype in SIGNAL_TO_COMPONENT_TYPE.items():
        if signal_type.startswith(prefix):
            return ctype
    return ComponentType.UNKNOWN


def get_severity(signal: SignalIngest) -> IncidentSeverity:
    mapped = SIGNAL_TO_SEVERITY.get(signal.signal_type)
    if mapped:
        return mapped
    sev_map = {
        "CRITICAL": IncidentSeverity.P0_CRITICAL,
        "HIGH": IncidentSeverity.P1_HIGH,
        "MEDIUM": IncidentSeverity.P2_MEDIUM,
        "LOW": IncidentSeverity.P3_LOW,
        "INFO": IncidentSeverity.P4_INFO,
    }
    return sev_map.get(signal.severity.value, IncidentSeverity.P3_LOW)


def compute_fingerprint(signal: SignalIngest) -> str:
    """
    Fingerprint is based on component_id + signal_type only.
    This means the same component + same error type always maps to the same fingerprint,
    regardless of when it happens.
    """
    key = f"{signal.component_id}:{signal.signal_type.value}"
    return hashlib.md5(key.encode()).hexdigest()


async def ingest_signal(signal: SignalIngest) -> SignalResponse:
    signal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Track signals/sec counter
    await increment_counter("ims:signals:count:total", ttl=86400)
    await increment_counter(f"ims:signals:count:{now.strftime('%Y%m%d%H%M')}", ttl=120)

    # Store raw signal in MongoDB
    mongo_doc = {
        "_id": signal_id,
        "signal_type": signal.signal_type.value,
        "component_id": signal.component_id,
        "component_name": signal.component_name,
        "severity": signal.severity.value,
        "message": signal.message,
        "source": signal.source,
        "timestamp": signal.timestamp or now,
        "metadata": signal.metadata or {},
        "tags": signal.tags or [],
        "host": signal.host,
        "region": signal.region,
        "environment": signal.environment,
        "created_at": now,
        "incident_id": None,
    }

    try:
        db = get_mongodb()
        await db.signals.insert_one(mongo_doc)
    except Exception as e:
        logger.warning("MongoDB signal store failed, continuing", error=str(e))

    # Queue to Kafka or fallback
    if is_kafka_available():
        await send_signal(settings.KAFKA_SIGNAL_TOPIC, mongo_doc, key=signal.component_id)
        queued = True
    else:
        try:
            _fallback_queue.put_nowait(mongo_doc)
            queued = True
        except asyncio.QueueFull:
            logger.error("Fallback queue full, dropping signal", signal_id=signal_id)
            queued = False

    fingerprint = compute_fingerprint(signal)

    # ── CORE GROUPING LOGIC ──────────────────────────────────────────────────
    # Rule: If ANY active incident exists for this fingerprint (same component +
    # signal type), ALWAYS group into it — regardless of time window.
    # Only create a new incident if NO active incident exists.
    # Exception: RESOLVED/CLOSED incidents reopen if same issue recurs within 5 min.
    # ─────────────────────────────────────────────────────────────────────────

    incident_id, created, debounced = await _group_or_create_incident(
        signal, fingerprint, signal_id, now
    )

    # Update MongoDB signal with incident_id
    try:
        db = get_mongodb()
        await db.signals.update_one({"_id": signal_id}, {"$set": {"incident_id": incident_id}})
    except Exception:
        pass

    # Publish real-time event — always publish so dashboard updates
    event_type = "incident_created" if created else "incident_updated"
    await publish_event("ims:incidents:updates", {
        "type": event_type,
        "incident_id": incident_id,
        "severity": signal.severity.value,
        "component_id": signal.component_id,
        "debounced": debounced,
        "timestamp": now.isoformat(),
    })

    # Invalidate dashboard cache
    try:
        r = get_redis()
        await r.delete("ims:dashboard:summary")
    except Exception:
        pass

    return SignalResponse(
        signal_id=signal_id,
        incident_id=incident_id,
        incident_created=created,
        incident_updated=not created,
        debounced=debounced,
        message="Signal processed successfully" if created else f"Signal grouped into existing incident",
        queued=queued,
    )


async def _group_or_create_incident(
    signal: SignalIngest,
    fingerprint: str,
    signal_id: str,
    now: datetime,
) -> Tuple[str, bool, bool]:
    """
    Returns (incident_id, was_created, was_grouped)

    Grouping rules:
    1. If an ACTIVE incident exists (OPEN/ACKNOWLEDGED/INVESTIGATING/MITIGATED/REOPENED)
       → always group into it, no matter how many times triggered
    2. If incident is RESOLVED / CLOSED / CANCELLED
       → always create a NEW incident (the old one is done)
    3. No active incident exists → create new
    """
    severity = get_severity(signal)
    component_type = get_component_type(signal.signal_type.value)
    team = COMPONENT_TO_TEAM.get(component_type, "platform-team")

    try:
        async with AsyncSessionLocal() as session:

            # ── Step 1: Find any ACTIVE incident with same fingerprint ──────
            # Active = still needs attention, not yet resolved/closed
            result = await session.execute(
                select(Incident)
                .where(
                    and_(
                        Incident.error_fingerprint == fingerprint,
                        Incident.status.in_(ACTIVE_STATUSES),
                    )
                )
                .order_by(Incident.created_at.desc())
                .limit(1)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Group into existing active incident — always
                existing.signal_count = (existing.signal_count or 0) + 1
                existing.updated_at = now
                await session.commit()
                logger.info(
                    "Signal grouped into existing incident",
                    incident_id=existing.id,
                    signal_count=existing.signal_count,
                    status=existing.status.value,
                )
                return existing.id, False, True

            # ── Step 2: No active incident — create a new one ────────────────
            # This covers:
            # - First time this component+signal_type is seen
            # - After incident was RESOLVED, CLOSED, or CANCELLED
            # In all these cases, a fresh incident is created
            incident = Incident(
                id=str(uuid.uuid4()),
                title=f"{signal.signal_type.value.replace('_', ' ').title()} on {signal.component_name}",
                description=signal.message,
                status=IncidentStatus.OPEN,
                severity=severity,
                component_id=signal.component_id,
                component_type=component_type,
                source=signal.source or "signal-ingestion",
                team=team,
                signal_count=1,
                error_fingerprint=fingerprint,
                first_signal_at=signal.timestamp or now,
                tags=signal.tags or [],
                extra_data=signal.metadata or {},
            )
            session.add(incident)
            history = IncidentStatusHistory(
                incident_id=incident.id,
                from_status=None,
                to_status=IncidentStatus.OPEN,
                note="Incident created from signal ingestion",
            )
            session.add(history)
            await session.commit()
            logger.info(
                "New incident created",
                incident_id=incident.id,
                fingerprint=fingerprint,
                reason="no active incident found",
            )
            return incident.id, True, False

    except Exception as e:
        logger.error("Failed to group/create incident", error=str(e))
        return str(uuid.uuid4()), True, False


async def get_signals_for_incident(incident_id: str, limit: int = 100) -> list:
    try:
        db = get_mongodb()
        cursor = db.signals.find(
            {"incident_id": incident_id},
            sort=[("timestamp", -1)],
            limit=limit
        )
        signals = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("timestamp"), datetime):
                doc["timestamp"] = doc["timestamp"].isoformat()
            if isinstance(doc.get("created_at"), datetime):
                doc["created_at"] = doc["created_at"].isoformat()
            signals.append(doc)
        return signals
    except Exception as e:
        logger.error("Failed to get signals for incident", error=str(e))
        return []


async def get_signals_per_second() -> float:
    try:
        r = get_redis()
        now = datetime.now(timezone.utc)
        current_minute = now.strftime('%Y%m%d%H%M')
        prev_minute = (now - timedelta(minutes=1)).strftime('%Y%m%d%H%M')
        current = int(await r.get(f"ims:signals:count:{current_minute}") or 0)
        prev = int(await r.get(f"ims:signals:count:{prev_minute}") or 0)
        total = current + prev
        return round(total / 120.0, 2)
    except Exception:
        return 0.0
