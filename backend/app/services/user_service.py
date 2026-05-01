from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.postgres_models import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.logging import logger
import uuid


async def create_user(db: AsyncSession, data: UserCreate) -> UserResponse:
    # Check duplicate
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise ValueError(f"Email {data.email} already registered")

    result2 = await db.execute(select(User).where(User.username == data.username))
    if result2.scalar_one_or_none():
        raise ValueError(f"Username {data.username} already taken")

    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole[data.role.value.upper()],
        team=data.team,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _to_response(user)


async def authenticate_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise ValueError("Invalid username or password")

    if not user.is_active:
        raise ValueError("Account is disabled")

    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role.value})
    return TokenResponse(access_token=token, user=_to_response(user))


async def get_user(db: AsyncSession, user_id: str) -> Optional[UserResponse]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return _to_response(user) if user else None


async def list_users(db: AsyncSession) -> List[UserResponse]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [_to_response(u) for u in result.scalars().all()]


async def update_user(db: AsyncSession, user_id: str, data: UserUpdate) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User {user_id} not found")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.team is not None:
        user.team = data.team
    if data.role is not None:
        user.role = UserRole[data.role.value.upper()]
    if data.is_active is not None:
        user.is_active = data.is_active

    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return _to_response(user)


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        team=user.team,
        is_active=user.is_active,
        created_at=user.created_at,
    )
