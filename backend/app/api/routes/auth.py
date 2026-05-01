from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_role
from app.schemas.user import UserCreate, UserUpdate, LoginRequest, TokenResponse, UserResponse
from app.services import user_service
from typing import List

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await user_service.authenticate_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    try:
        return await user_service.create_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = await user_service.get_user(db, current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "engineer")),
):
    return await user_service.list_users(db)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    try:
        return await user_service.update_user(db, user_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
