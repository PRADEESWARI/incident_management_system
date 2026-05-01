from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_role
from app.schemas.rca import RCACreate, RCAResponse, RCA_CATEGORIES
from app.services import rca_service

router = APIRouter(prefix="/rca", tags=["RCA"])


@router.get("/categories")
async def get_rca_categories():
    return {"categories": RCA_CATEGORIES}


@router.get("/{incident_id}", response_model=RCAResponse)
async def get_rca(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    rca = await rca_service.get_rca(db, incident_id)
    if not rca:
        raise HTTPException(status_code=404, detail="RCA not found for this incident")
    return rca


@router.post("/{incident_id}", response_model=RCAResponse, status_code=201)
async def create_or_update_rca(
    incident_id: str,
    data: RCACreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    try:
        return await rca_service.create_or_update_rca(db, incident_id, data, current_user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
