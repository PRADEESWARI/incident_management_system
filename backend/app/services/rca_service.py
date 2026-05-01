from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.postgres_models import Incident, RCA, User, IncidentStatus
from app.schemas.rca import RCACreate, RCAUpdate, RCAResponse
from app.db.redis_client import cache_delete
from app.core.logging import logger
import uuid


async def create_or_update_rca(
    db: AsyncSession, incident_id: str, data: RCACreate, user_id: str
) -> RCAResponse:
    # Verify incident exists
    inc_result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = inc_result.scalar_one_or_none()
    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    # Calculate MTTR
    start = data.incident_start_time
    end = data.incident_end_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    mttr_seconds = (end - start).total_seconds()

    # Check for existing RCA
    rca_result = await db.execute(select(RCA).where(RCA.incident_id == incident_id))
    existing_rca = rca_result.scalar_one_or_none()

    if existing_rca:
        existing_rca.incident_start_time = data.incident_start_time
        existing_rca.incident_end_time = data.incident_end_time
        existing_rca.root_cause_category = data.root_cause_category
        existing_rca.root_cause_summary = data.root_cause_summary
        existing_rca.fix_applied = data.fix_applied
        existing_rca.prevention_steps = data.prevention_steps
        existing_rca.lessons_learned = data.lessons_learned
        existing_rca.owner_id = user_id
        existing_rca.mttr_seconds = mttr_seconds
        existing_rca.draft = data.draft
        existing_rca.updated_at = datetime.now(timezone.utc)
        rca = existing_rca
    else:
        rca = RCA(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            incident_start_time=data.incident_start_time,
            incident_end_time=data.incident_end_time,
            root_cause_category=data.root_cause_category,
            root_cause_summary=data.root_cause_summary,
            fix_applied=data.fix_applied,
            prevention_steps=data.prevention_steps,
            lessons_learned=data.lessons_learned,
            owner_id=user_id,
            mttr_seconds=mttr_seconds,
            draft=data.draft,
        )
        db.add(rca)

    # Mark incident RCA as completed if not draft
    if not data.draft:
        incident.rca_completed = True
        incident.mttr_seconds = mttr_seconds

    await db.commit()
    await db.refresh(rca)
    await cache_delete("ims:dashboard:summary")

    # Get owner name
    owner_result = await db.execute(select(User).where(User.id == user_id))
    owner = owner_result.scalar_one_or_none()

    return RCAResponse(
        id=rca.id,
        incident_id=rca.incident_id,
        incident_start_time=rca.incident_start_time,
        incident_end_time=rca.incident_end_time,
        root_cause_category=rca.root_cause_category,
        root_cause_summary=rca.root_cause_summary,
        fix_applied=rca.fix_applied,
        prevention_steps=rca.prevention_steps,
        lessons_learned=rca.lessons_learned,
        owner_id=rca.owner_id,
        owner_name=owner.full_name if owner else None,
        mttr_seconds=rca.mttr_seconds,
        draft=rca.draft,
        created_at=rca.created_at,
        updated_at=rca.updated_at,
    )


async def get_rca(db: AsyncSession, incident_id: str) -> Optional[RCAResponse]:
    result = await db.execute(
        select(RCA, User).join(User, RCA.owner_id == User.id, isouter=True)
        .where(RCA.incident_id == incident_id)
    )
    row = result.first()
    if not row:
        return None
    rca, owner = row
    return RCAResponse(
        id=rca.id,
        incident_id=rca.incident_id,
        incident_start_time=rca.incident_start_time,
        incident_end_time=rca.incident_end_time,
        root_cause_category=rca.root_cause_category,
        root_cause_summary=rca.root_cause_summary,
        fix_applied=rca.fix_applied,
        prevention_steps=rca.prevention_steps,
        lessons_learned=rca.lessons_learned,
        owner_id=rca.owner_id,
        owner_name=owner.full_name if owner else None,
        mttr_seconds=rca.mttr_seconds,
        draft=rca.draft,
        created_at=rca.created_at,
        updated_at=rca.updated_at,
    )
