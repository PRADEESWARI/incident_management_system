from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
from app.models.postgres_models import (
    Incident, IncidentStatus, IncidentSeverity, IncidentStatusHistory,
    Comment, User, RCA
)
from app.schemas.incident import (
    IncidentCreate, IncidentUpdate, StatusTransition,
    IncidentResponse, IncidentListResponse, CommentCreate, CommentResponse
)
from app.db.redis_client import cache_get, cache_set, cache_delete, publish_event
from app.core.logging import logger
from app.core.security import get_current_user
import uuid

# Valid state transitions
VALID_TRANSITIONS: Dict[IncidentStatus, List[IncidentStatus]] = {
    IncidentStatus.OPEN: [
        IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING,
        IncidentStatus.CANCELLED
    ],
    IncidentStatus.ACKNOWLEDGED: [
        IncidentStatus.INVESTIGATING, IncidentStatus.MITIGATED,
        IncidentStatus.CANCELLED
    ],
    IncidentStatus.INVESTIGATING: [
        IncidentStatus.MITIGATED, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED
    ],
    IncidentStatus.MITIGATED: [
        IncidentStatus.RESOLVED, IncidentStatus.INVESTIGATING
    ],
    IncidentStatus.RESOLVED: [
        IncidentStatus.CLOSED, IncidentStatus.REOPENED
    ],
    IncidentStatus.CLOSED: [
        IncidentStatus.REOPENED
    ],
    IncidentStatus.REOPENED: [
        IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING,
        IncidentStatus.RESOLVED, IncidentStatus.CANCELLED
    ],
    IncidentStatus.CANCELLED: [],
}


def is_valid_transition(from_status: IncidentStatus, to_status: IncidentStatus) -> bool:
    return to_status in VALID_TRANSITIONS.get(from_status, [])


async def create_incident(db: AsyncSession, data: IncidentCreate, user_id: str) -> IncidentResponse:
    incident = Incident(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        status=IncidentStatus.OPEN,
        severity=IncidentSeverity[data.severity.value],
        component_id=data.component_id,
        component_type=data.component_type,
        source=data.source,
        assignee_id=data.assignee_id,
        team=data.team,
        tags=data.tags or [],
        extra_data=data.extra_data or {},
        first_signal_at=datetime.now(timezone.utc),
    )
    db.add(incident)
    history = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=None,
        to_status=IncidentStatus.OPEN,
        changed_by_id=user_id,
        note="Incident created manually",
    )
    db.add(history)
    await db.commit()
    await db.refresh(incident)
    await cache_delete("ims:dashboard:summary")
    return await _to_response(db, incident)


async def get_incident(db: AsyncSession, incident_id: str) -> Optional[IncidentResponse]:
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        return None
    return await _to_response(db, incident)


async def list_incidents(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    component_id: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
) -> IncidentListResponse:
    filters = []
    if status:
        filters.append(Incident.status == IncidentStatus[status])
    if severity:
        filters.append(Incident.severity == IncidentSeverity[severity])
    if component_id:
        filters.append(Incident.component_id.ilike(f"%{component_id}%"))
    if team:
        filters.append(Incident.team == team)
    if source:
        filters.append(Incident.source == source)
    if date_from:
        filters.append(Incident.created_at >= date_from)
    if date_to:
        filters.append(Incident.created_at <= date_to)
    if search:
        filters.append(or_(
            Incident.title.ilike(f"%{search}%"),
            Incident.component_id.ilike(f"%{search}%"),
            Incident.id.ilike(f"%{search}%"),
        ))

    count_q = select(func.count(Incident.id))
    if filters:
        count_q = count_q.where(and_(*filters))
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    sort_col = getattr(Incident, sort_by, Incident.created_at)
    order = desc(sort_col) if sort_dir == "desc" else asc(sort_col)

    q = select(Incident).order_by(order).offset((page - 1) * page_size).limit(page_size)
    if filters:
        q = q.where(and_(*filters))

    result = await db.execute(q)
    incidents = result.scalars().all()

    items = []
    for inc in incidents:
        items.append(await _to_response(db, inc))

    return IncidentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


async def transition_incident(
    db: AsyncSession, incident_id: str, transition: StatusTransition, user_id: str
) -> IncidentResponse:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    from_status = incident.status
    to_status = IncidentStatus[transition.to_status.value]

    if not is_valid_transition(from_status, to_status):
        raise ValueError(f"Invalid transition from {from_status.value} to {to_status.value}")

    # Require RCA before CLOSED
    if to_status == IncidentStatus.CLOSED and not incident.rca_completed:
        raise ValueError("Cannot close incident without completing RCA")

    now = datetime.now(timezone.utc)
    incident.status = to_status
    incident.updated_at = now

    if to_status == IncidentStatus.ACKNOWLEDGED:
        incident.acknowledged_at = now
    elif to_status == IncidentStatus.RESOLVED:
        incident.resolved_at = now
        if incident.first_signal_at:
            delta = now - incident.first_signal_at.replace(tzinfo=timezone.utc) if incident.first_signal_at.tzinfo is None else now - incident.first_signal_at
            incident.mttr_seconds = delta.total_seconds()
    elif to_status == IncidentStatus.CLOSED:
        incident.closed_at = now

    history = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=from_status,
        to_status=to_status,
        changed_by_id=user_id,
        note=transition.note,
    )
    db.add(history)
    await db.commit()
    await db.refresh(incident)

    await publish_event("ims:incidents:updates", {
        "type": "status_changed",
        "incident_id": incident_id,
        "from_status": from_status.value,
        "to_status": to_status.value,
        "timestamp": now.isoformat(),
    })
    await cache_delete("ims:dashboard:summary")

    return await _to_response(db, incident)


async def update_incident(
    db: AsyncSession, incident_id: str, data: IncidentUpdate, user_id: str
) -> IncidentResponse:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    if data.title is not None:
        incident.title = data.title
    if data.description is not None:
        incident.description = data.description
    if data.severity is not None:
        incident.severity = IncidentSeverity[data.severity.value]
    if data.assignee_id is not None:
        incident.assignee_id = data.assignee_id
    if data.team is not None:
        incident.team = data.team
    if data.tags is not None:
        incident.tags = data.tags

    incident.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(incident)
    await cache_delete("ims:dashboard:summary")
    return await _to_response(db, incident)


async def add_comment(
    db: AsyncSession, incident_id: str, data: CommentCreate, user_id: str
) -> CommentResponse:
    comment = Comment(
        id=str(uuid.uuid4()),
        incident_id=incident_id,
        author_id=user_id,
        content=data.content,
        is_internal=data.is_internal,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    return CommentResponse(
        id=comment.id,
        incident_id=comment.incident_id,
        author_id=comment.author_id,
        author_name=user.full_name if user else None,
        content=comment.content,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


async def get_comments(db: AsyncSession, incident_id: str) -> List[CommentResponse]:
    result = await db.execute(
        select(Comment, User).join(User, Comment.author_id == User.id, isouter=True)
        .where(Comment.incident_id == incident_id)
        .order_by(Comment.created_at.asc())
    )
    rows = result.all()
    return [
        CommentResponse(
            id=c.id,
            incident_id=c.incident_id,
            author_id=c.author_id,
            author_name=u.full_name if u else None,
            content=c.content,
            is_internal=c.is_internal,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, u in rows
    ]


async def get_status_history(db: AsyncSession, incident_id: str) -> list:
    result = await db.execute(
        select(IncidentStatusHistory, User)
        .join(User, IncidentStatusHistory.changed_by_id == User.id, isouter=True)
        .where(IncidentStatusHistory.incident_id == incident_id)
        .order_by(IncidentStatusHistory.created_at.asc())
    )
    rows = result.all()
    return [
        {
            "id": h.id,
            "incident_id": h.incident_id,
            "from_status": h.from_status.value if h.from_status else None,
            "to_status": h.to_status.value,
            "changed_by_id": h.changed_by_id,
            "changed_by_name": u.full_name if u else None,
            "note": h.note,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h, u in rows
    ]


async def _to_response(db: AsyncSession, incident: Incident) -> IncidentResponse:
    assignee_name = None
    if incident.assignee_id:
        result = await db.execute(select(User).where(User.id == incident.assignee_id))
        user = result.scalar_one_or_none()
        if user:
            assignee_name = user.full_name

    return IncidentResponse(
        id=incident.id,
        incident_number=incident.incident_number,
        title=incident.title,
        description=incident.description,
        status=incident.status.value,
        severity=incident.severity.value,
        component_id=incident.component_id,
        component_type=incident.component_type.value if incident.component_type else None,
        source=incident.source,
        assignee_id=incident.assignee_id,
        assignee_name=assignee_name,
        team=incident.team,
        signal_count=incident.signal_count or 1,
        error_fingerprint=incident.error_fingerprint,
        parent_incident_id=incident.parent_incident_id,
        first_signal_at=incident.first_signal_at,
        acknowledged_at=incident.acknowledged_at,
        resolved_at=incident.resolved_at,
        closed_at=incident.closed_at,
        mttr_seconds=incident.mttr_seconds,
        rca_completed=incident.rca_completed or False,
        tags=incident.tags or [],
        extra_data=incident.extra_data or {},
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )
