"""Enterprise SSO Service (Google Workspace, OIDC)."""

import secrets
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.enums import AuthProvider, UserRole, UserStatus
from app.models.user import User
from app.repositories.user import UserRepository, normalize_email

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleSSOProvider:
    """Google Workspace / Google Identity OpenID Connect Provider."""

    @classmethod
    def is_configured(cls) -> bool:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    @classmethod
    def get_authorization_url(cls, redirect_uri: str, state: str) -> str:
        """Build Google OAuth2 authorization consent URL."""
        if not cls.is_configured():
            # For development simulation when live credentials are not yet set
            params = {
                "redirect_uri": redirect_uri,
                "state": state,
                "mock": "true",
            }
            return f"{redirect_uri}?{urlencode(params)}"

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    @classmethod
    async def exchange_code(cls, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for verified Google user profile."""
        # Handle development simulation code
        if code.startswith("mock_google_code_") or not cls.is_configured():
            # Extract mock email or fallback to test profile
            mock_email = "workspace.user@example.com"
            if "::" in code:
                _, custom_email = code.split("::", 1)
                mock_email = custom_email
            return {
                "email": mock_email,
                "given_name": "Google",
                "family_name": "Workspace User",
                "email_verified": True,
                "sub": "mock-google-sub-12345",
            }

        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                raise AuthenticationError("Failed to authenticate with Google. Invalid authorization code.")

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                raise AuthenticationError("Google did not return an access token.")

            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if userinfo_response.status_code != 200:
                raise AuthenticationError("Failed to fetch user profile from Google.")

            profile = userinfo_response.json()
            return profile


class SSOService:
    """Orchestrates SSO token exchange, domain validation, JIT provisioning, and JWT issuance."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)

    def generate_state(self) -> str:
        return secrets.token_urlsafe(32)

    def validate_domain(self, email: str) -> None:
        """Enforce domain restrictions if SSO_ALLOWED_DOMAINS is configured."""
        if not settings.SSO_ALLOWED_DOMAINS:
            return

        domain = email.split("@")[-1].lower() if "@" in email else ""
        allowed = [d.lstrip("@").lower() for d in settings.SSO_ALLOWED_DOMAINS]

        if domain not in allowed:
            raise AuthenticationError(
                f"Access denied: Google Workspace domain '@{domain}' is not authorized for this organization."
            )

    async def authenticate_google(
        self,
        code: str,
        redirect_uri: str,
    ) -> tuple[User, str, str]:
        """Verify Google credentials, provision/update user, and issue LearnFlow JWTs."""
        profile = await GoogleSSOProvider.exchange_code(code, redirect_uri)

        raw_email = profile.get("email")
        if not raw_email:
            raise AuthenticationError("Google profile did not provide a valid email address.")

        email = normalize_email(raw_email)
        self.validate_domain(email)

        # Look up existing user
        user = await self.users.get_by_email(email)

        if user is None:
            # Just-in-Time (JIT) Provisioning
            if not settings.SSO_AUTO_PROVISION:
                raise AuthenticationError(
                    "No LearnFlow account found for this Google Workspace address. "
                    "Contact your administrator to create an account."
                )

            first_name = profile.get("given_name") or profile.get("name", "Google").split()[0]
            last_name = (
                profile.get("family_name")
                or (profile.get("name", "User").split()[-1] if len(profile.get("name", "").split()) > 1 else "User")
            )

            # Generate random unguessable password hash for SSO-managed account
            random_pw = secrets.token_hex(32)
            secure_hash = hash_password(random_pw)

            try:
                default_role = UserRole(settings.SSO_DEFAULT_ROLE)
            except ValueError:
                default_role = UserRole.USER

            user = User(
                id=uuid4(),
                email=email,
                first_name=first_name,
                last_name=last_name,
                password_hash=secure_hash,
                role=default_role,
                status=UserStatus.ACTIVE,
                auth_provider=AuthProvider.GOOGLE,
                token_version=1,
            )
            self.users.add(user)
            await self.session.commit()
            await self.session.refresh(user)

        else:
            # Check user status
            if user.status != UserStatus.ACTIVE:
                raise AuthenticationError("Your LearnFlow account has been deactivated.")

        # Issue standard LearnFlow access and refresh JWTs
        access_token = create_access_token(user.id, user.role.value)
        refresh_token = create_refresh_token(user.id, user.token_version)

        return user, access_token, refresh_token
