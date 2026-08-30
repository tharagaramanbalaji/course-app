"""Schemas for Single Sign-On (SSO) integration."""

from app.schemas.base import CamelModel
from app.schemas.user import UserRead


class SSOProviderInfo(CamelModel):
    provider: str
    display_name: str
    enabled: bool


class SSOAuthorizeResponse(CamelModel):
    authorization_url: str
    state: str


class SSOCallbackRequest(CamelModel):
    code: str
    state: str | None = None


class SSOLoginResponse(CamelModel):
    access_token: str
    refresh_token: str
    user: UserRead
