"""Authentication payloads (section 2)."""

from pydantic import EmailStr, Field

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.base import CamelModel
from app.schemas.user import UserRead


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=1)


class AccessTokenResponse(CamelModel):
    access_token: str


class LoginResponse(CamelModel):
    access_token: str
    refresh_token: str
    user: UserRead
