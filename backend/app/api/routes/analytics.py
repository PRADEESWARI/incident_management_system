from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await analytics_service.get_dashboard_summary(db)


@router.get("/mttr-trends")
async def get_mttr_trends(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await analytics_service.get_mttr_trends(db, days=days)


@router.get("/service-health")
async def get_service_health(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    services = await analytics_service.get_service_health(db)
    return {"services": services, "total": len(services)}
