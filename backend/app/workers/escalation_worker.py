import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_
from app.db.postgres import AsyncSessionLocal
from app.models.postgres_models import Incident, IncidentStatus, IncidentSeverity, IncidentStatusHistory
from app.db.redis_client import publish_event
from app.core.config import settings
from app.core.logging import logger


async def run_escalation_worker():
    """Background worker that auto-escalates unresolved incidents."""
    logger.info("Escalation worker started")
    while True:
        try:
            await _check_escalations()
        except Exception as e:
            logger.error("Escalation worker error", error=str(e))
        await asyncio.sleep(60)  # Check every minute


async def _check_escalations():
    now = datetime.now(timezone.utc)
    p2_threshold = now - timedelta(minutes=settings.ESCALATION_P2_TO_P1_MINUTES)
    p1_threshold = now - timedelta(minutes=settings.ESCALATION_P1_TO_P0_MINUTES)

    # Only escalate incidents created in the last 24 hours
    # This prevents old seed data from being constantly escalated
    max_age = now - timedelta(hours=24)

    async with AsyncSessionLocal() as session:
        # P2 → P1 escalation
        result = await session.execute(
            select(Incident).where(
                and_(
                    Incident.severity == IncidentSeverity.P2_MEDIUM,
                    Incident.status.in_([
                        IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED
                    ]),
                    Incident.created_at <= p2_threshold,
                    Incident.created_at >= max_age,  # Only recent incidents
                )
            )
        )
        p2_incidents = result.scalars().all()

        for incident in p2_incidents:
            incident.severity = IncidentSeverity.P1_HIGH
            incident.updated_at = now
            history = IncidentStatusHistory(
                incident_id=incident.id,
                from_status=incident.status,
                to_status=incident.status,
                note=f"Auto-escalated P2→P1 after {settings.ESCALATION_P2_TO_P1_MINUTES} minutes unresolved",
            )
            session.add(history)
            await publish_event("ims:incidents:updates", {
                "type": "escalated",
                "incident_id": incident.id,
                "from_severity": "P2_MEDIUM",
                "to_severity": "P1_HIGH",
                "timestamp": now.isoformat(),
            })
            logger.info("Incident escalated P2→P1", incident_id=incident.id)

        # P1 → P0 escalation
        result2 = await session.execute(
            select(Incident).where(
                and_(
                    Incident.severity == IncidentSeverity.P1_HIGH,
                    Incident.status.in_([
                        IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED
                    ]),
                    Incident.created_at <= p1_threshold,
                    Incident.created_at >= max_age,  # Only recent incidents
                )
            )
        )
        p1_incidents = result2.scalars().all()

        for incident in p1_incidents:
            incident.severity = IncidentSeverity.P0_CRITICAL
            incident.updated_at = now
            history = IncidentStatusHistory(
                incident_id=incident.id,
                from_status=incident.status,
                to_status=incident.status,
                note=f"Auto-escalated P1→P0 after {settings.ESCALATION_P1_TO_P0_MINUTES} minutes unresolved",
            )
            session.add(history)
            await publish_event("ims:incidents:updates", {
                "type": "escalated",
                "incident_id": incident.id,
                "from_severity": "P1_HIGH",
                "to_severity": "P0_CRITICAL",
                "timestamp": now.isoformat(),
            })
            logger.info("Incident escalated P1→P0", incident_id=incident.id)

        await session.commit()
