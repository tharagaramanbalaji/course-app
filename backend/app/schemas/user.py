"""User payloads (section 3).

``password_hash`` and ``token_version`` appear in no schema, so they cannot
leak through a response.
"""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.core.security import MAX_PASSWORD_BYTES
from app.models.enums import UserRole, UserStatus
from app.schemas.base import CamelModel

MIN_PASSWORD_LENGTH = 8


class UserRead(CamelModel):
    id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole
    status: UserStatus
    created_at: datetime


class UserCreate(CamelModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_BYTES)
    role: UserRole = UserRole.USER


class UserUpdate(CamelModel):
    """Role and status are deliberately absent; each has its own endpoint."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=255)
    status: UserStatus | None = None


class UserRoleUpdate(CamelModel):
    role: UserRole


class UserStatusUpdate(CamelModel):
    status: UserStatus
