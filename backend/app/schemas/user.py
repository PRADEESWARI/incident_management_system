from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=200)
    password: str = Field(..., min_length=8)
    role: UserRoleEnum = UserRoleEnum.ENGINEER
    team: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    team: Optional[str] = None
    role: Optional[UserRoleEnum] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: str
    team: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
