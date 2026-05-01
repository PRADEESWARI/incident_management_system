import asyncio
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
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
from sqlalchemy import select, and_, func
import uuid

# In-memory fallback queue when Kafka/DB unavailable
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

    # Try Kafka first, fallback to in-memory queue
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

    # Debounce + correlation
    fingerprint = compute_fingerprint(signal)
    debounce_key = f"ims:debounce:{fingerprint}"
    window = settings.DEBOUNCE_WINDOW_SECONDS

    try:
        r = get_redis()
        debounce_count = await r.incr(debounce_key)
        if debounce_count == 1:
            await r.expire(debounce_key, window)

        if debounce_count > settings.DEBOUNCE_THRESHOLD:
            # Find existing open incident and increment signal count
            incident_id = await _find_and_update_existing_incident(signal, fingerprint, signal_id)
            if incident_id:
                return SignalResponse(
                    signal_id=signal_id,
                    incident_id=incident_id,
                    incident_created=False,
                    incident_updated=True,
                    debounced=True,
                    message=f"Signal debounced. Linked to existing incident {incident_id}",
                    queued=queued,
                )
    except Exception as e:
        logger.warning("Redis debounce check failed", error=str(e))

    # Create or update incident
    incident_id, created = await _create_or_update_incident(signal, fingerprint, signal_id, now)

    # Update MongoDB signal with incident_id
    try:
        db = get_mongodb()
        await db.signals.update_one({"_id": signal_id}, {"$set": {"incident_id": incident_id}})
    except Exception:
        pass

    # Publish real-time event
    await publish_event("ims:incidents:updates", {
        "type": "incident_created" if created else "incident_updated",
        "incident_id": incident_id,
        "severity": signal.severity.value,
        "component_id": signal.component_id,
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
        debounced=False,
        message="Signal processed successfully",
        queued=queued,
    )


async def _find_and_update_existing_incident(signal: SignalIngest, fingerprint: str, signal_id: str) -> Optional[str]:
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Incident).where(
                    and_(
                        Incident.error_fingerprint == fingerprint,
                        Incident.status.in_([
                            IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                            IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                        ])
                    )
                ).order_by(Incident.created_at.desc()).limit(1)
            )
            incident = result.scalar_one_or_none()
            if incident:
                incident.signal_count += 1
                incident.updated_at = datetime.now(timezone.utc)
                await session.commit()
                return incident.id
    except Exception as e:
        logger.error("Failed to update existing incident", error=str(e))
    return None


async def _create_or_update_incident(
    signal: SignalIngest, fingerprint: str, signal_id: str, now: datetime
) -> tuple[str, bool]:
    severity = get_severity(signal)
    component_type = get_component_type(signal.signal_type.value)
    team = COMPONENT_TO_TEAM.get(component_type, "platform-team")

    try:
        async with AsyncSessionLocal() as session:
            # Check for existing open incident with same fingerprint
            result = await session.execute(
                select(Incident).where(
                    and_(
                        Incident.error_fingerprint == fingerprint,
                        Incident.status.in_([
                            IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                            IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                        ])
                    )
                ).order_by(Incident.created_at.desc()).limit(1)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.signal_count += 1
                existing.updated_at = now
                await session.commit()
                return existing.id, False

            # Check for recently closed incident (reopen logic)
            reopen_window = now - timedelta(minutes=5)
            result2 = await session.execute(
                select(Incident).where(
                    and_(
                        Incident.error_fingerprint == fingerprint,
                        Incident.status.in_([IncidentStatus.RESOLVED, IncidentStatus.CLOSED]),
                        Incident.updated_at >= reopen_window
                    )
                ).order_by(Incident.created_at.desc()).limit(1)
            )
            recently_closed = result2.scalar_one_or_none()

            if recently_closed:
                recently_closed.status = IncidentStatus.REOPENED
                recently_closed.signal_count += 1
                recently_closed.updated_at = now
                history = IncidentStatusHistory(
                    incident_id=recently_closed.id,
                    from_status=recently_closed.status,
                    to_status=IncidentStatus.REOPENED,
                    note="Auto-reopened: same issue recurred within 5 minutes",
                )
                session.add(history)
                await session.commit()
                return recently_closed.id, False

            # Create new incident
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
            return incident.id, True

    except Exception as e:
        logger.error("Failed to create/update incident", error=str(e))
        # Return a placeholder ID so the signal isn't lost
        return str(uuid.uuid4()), True


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
