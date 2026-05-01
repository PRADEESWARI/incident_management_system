from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_role
from app.schemas.incident import (
    IncidentCreate, IncidentUpdate, StatusTransition,
    IncidentResponse, IncidentListResponse, CommentCreate
)
from app.services import incident_service
from app.services.signal_service import get_signals_for_incident
from app.core.logging import logger

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    component_id: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = Query("created_at", regex="^(created_at|severity|status|signal_count)$"),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await incident_service.list_incidents(
        db, page=page, page_size=page_size,
        status=status, severity=severity, component_id=component_id,
        team=team, search=search, source=source,
        date_from=date_from, date_to=date_to,
        sort_by=sort_by, sort_dir=sort_dir,
    )


@router.post("", response_model=IncidentResponse, status_code=201)
async def create_incident(
    data: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    return await incident_service.create_incident(db, data, current_user["sub"])


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    incident = await incident_service.get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    try:
        return await incident_service.update_incident(db, incident_id, data, current_user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{incident_id}/transition", response_model=IncidentResponse)
async def transition_incident(
    incident_id: str,
    transition: StatusTransition,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    try:
        return await incident_service.transition_incident(db, incident_id, transition, current_user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{incident_id}/signals")
async def get_incident_signals(
    incident_id: str,
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
):
    signals = await get_signals_for_incident(incident_id, limit=limit)
    return {"incident_id": incident_id, "signals": signals, "count": len(signals)}


@router.get("/{incident_id}/comments")
async def get_comments(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    comments = await incident_service.get_comments(db, incident_id)
    return {"incident_id": incident_id, "comments": comments}


@router.post("/{incident_id}/comments", status_code=201)
async def add_comment(
    incident_id: str,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    return await incident_service.add_comment(db, incident_id, data, current_user["sub"])


@router.get("/{incident_id}/history")
async def get_status_history(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    history = await incident_service.get_status_history(db, incident_id)
    return {"incident_id": incident_id, "history": history}


@router.patch("/{incident_id}/reassign")
async def reassign_incident(
    incident_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only: reassign owner and/or team for an incident."""
    from sqlalchemy import select as sa_select
    from app.models.postgres_models import Incident, User
    from datetime import datetime, timezone

    result = await db.execute(sa_select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    assignee_name = None
    if "assignee_id" in payload and payload["assignee_id"]:
        user_result = await db.execute(sa_select(User).where(User.id == payload["assignee_id"]))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        incident.assignee_id = payload["assignee_id"]
        assignee_name = user.full_name

    if "team" in payload and payload["team"]:
        incident.team = payload["team"]

    incident.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(incident)

    # Invalidate AI summary cache
    from app.db.redis_client import cache_delete
    await cache_delete(f"ims:ai:summary:{incident_id}")
    await cache_delete("ims:dashboard:summary")

    return {
        "incident_id": incident_id,
        "assignee_id": incident.assignee_id,
        "assignee_name": assignee_name,
        "team": incident.team,
        "message": "Incident reassigned successfully",
    }
