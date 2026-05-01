from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.postgres import get_db
from app.core.security import get_current_user
from app.models.postgres_models import Incident, User
from app.services.ai_service import generate_incident_summary
from app.services.signal_service import get_signals_for_incident
from app.db.redis_client import cache_get, cache_set
from app.core.logging import logger

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/incidents/{incident_id}/summary")
async def get_ai_summary(
    incident_id: str,
    refresh: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate an AI-powered summary for an incident.
    Uses HuggingFace Llama-3.3-70B if HF_TOKEN is set,
    otherwise uses intelligent rule-based analysis.
    Cached in Redis for 10 minutes.
    """
    cache_key = f"ims:ai:summary:{incident_id}"

    # Return cached result unless refresh requested
    if not refresh:
        cached = await cache_get(cache_key)
        if cached:
            cached['cached'] = True
            return cached

    # Fetch incident
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Fetch assignee name
    assignee_name = None
    if incident.assignee_id:
        user_result = await db.execute(select(User).where(User.id == incident.assignee_id))
        user = user_result.scalar_one_or_none()
        if user:
            assignee_name = user.full_name

    # Build incident data dict
    incident_data = {
        "id": incident.id,
        "title": incident.title,
        "description": incident.description,
        "severity": incident.severity.value,
        "status": incident.status.value,
        "component_id": incident.component_id,
        "component_type": incident.component_type.value if incident.component_type else "UNKNOWN",
        "team": incident.team,
        "assignee_name": assignee_name,
        "signal_count": incident.signal_count or 1,
        "first_signal_at": incident.first_signal_at.isoformat() if incident.first_signal_at else None,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "mttr_seconds": incident.mttr_seconds,
        "rca_completed": incident.rca_completed,
        "tags": incident.tags or [],
    }

    # Fetch recent signals from MongoDB
    signals = await get_signals_for_incident(incident_id, limit=10)

    # Generate summary
    try:
        summary = await generate_incident_summary(incident_data, signals)
        summary['incident_id'] = incident_id
        summary['cached'] = False

        # Cache for 10 minutes
        await cache_set(cache_key, summary, ttl=600)
        return summary

    except Exception as e:
        logger.error("AI summary generation failed", incident_id=incident_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"AI summary failed: {str(e)}")
