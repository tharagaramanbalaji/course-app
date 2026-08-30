"""Enterprise SSO endpoints (Google Workspace, OIDC)."""

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.core.config import settings
from app.schemas.common import DataResponse
from app.schemas.sso import (
    SSOAuthorizeResponse,
    SSOCallbackRequest,
    SSOLoginResponse,
    SSOProviderInfo,
)
from app.schemas.user import UserRead
from app.services.sso import GoogleSSOProvider, SSOService

router = APIRouter(prefix="/auth/sso", tags=["sso"])


@router.get("/providers", response_model=DataResponse[list[SSOProviderInfo]])
async def list_sso_providers() -> DataResponse[list[SSOProviderInfo]]:
    """List available and configured enterprise SSO identity providers."""
    providers = [
        SSOProviderInfo(
            provider="GOOGLE",
            display_name="Google Workspace",
            enabled=True,  # Supports live credentials or development simulation
        ),
        SSOProviderInfo(
            provider="MICROSOFT",
            display_name="Microsoft Entra ID",
            enabled=False,
        ),
        SSOProviderInfo(
            provider="OKTA",
            display_name="Okta Workforce Identity",
            enabled=False,
        ),
    ]
    return DataResponse(data=providers)


@router.get("/google/authorize", response_model=DataResponse[SSOAuthorizeResponse])
async def google_sso_authorize(
    redirect_uri: str = Query(
        default=f"{settings.FRONTEND_URL}/login",
        description="Frontend redirect URI for OAuth2 callback",
    ),
    db: DbSession = None,
) -> DataResponse[SSOAuthorizeResponse]:
    """Generate Google OAuth2 authorization URL and secure state parameter."""
    sso_service = SSOService(db)
    state = sso_service.generate_state()
    auth_url = GoogleSSOProvider.get_authorization_url(redirect_uri, state)
    return DataResponse(data=SSOAuthorizeResponse(authorization_url=auth_url, state=state))


@router.post("/google/callback", response_model=DataResponse[SSOLoginResponse])
async def google_sso_callback(
    payload: SSOCallbackRequest,
    redirect_uri: str = Query(
        default=f"{settings.FRONTEND_URL}/login",
        description="Matching redirect URI used in authorization step",
    ),
    db: DbSession = None,
) -> DataResponse[SSOLoginResponse]:
    """Exchange authorization code from Google for LearnFlow JWT tokens and user profile."""
    sso_service = SSOService(db)
    user, access_token, refresh_token = await sso_service.authenticate_google(
        payload.code,
        redirect_uri,
    )
    return DataResponse(
        data=SSOLoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserRead.model_validate(user),
        )
    )
