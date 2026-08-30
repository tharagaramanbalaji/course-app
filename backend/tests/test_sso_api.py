"""SSO Authentication API tests (Google Workspace / OIDC)."""

import pytest

from app.models.enums import UserRole, UserStatus
from tests import factories as f

SSO_PROVIDERS = "/api/v1/auth/sso/providers"
SSO_GOOGLE_AUTHORIZE = "/api/v1/auth/sso/google/authorize"
SSO_GOOGLE_CALLBACK = "/api/v1/auth/sso/google/callback"


async def test_list_sso_providers_returns_google_workspace(client):
    response = await client.get(SSO_PROVIDERS)
    assert response.status_code == 200
    providers = response.json()["data"]
    assert any(p["provider"] == "GOOGLE" and p["enabled"] is True for p in providers)


async def test_google_sso_authorize_generates_auth_url_and_state(client):
    response = await client.get(SSO_GOOGLE_AUTHORIZE)
    assert response.status_code == 200
    data = response.json()["data"]
    assert "authorizationUrl" in data
    assert "state" in data
    assert len(data["state"]) > 10


async def test_google_sso_callback_auto_provisions_new_user(client, db_session):
    test_email = "new.employee@company.org"
    response = await client.post(
        SSO_GOOGLE_CALLBACK,
        json={"code": f"mock_google_code_::{test_email}", "state": "test-state"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["accessToken"]
    assert data["refreshToken"]
    assert data["user"]["email"] == test_email
    assert data["user"]["role"] == "USER"


async def test_google_sso_callback_logs_in_existing_admin(client, db_session):
    admin_user = await f.make_user(
        db_session,
        email="sso.admin@company.org",
        role=UserRole.ADMIN,
    )

    response = await client.post(
        SSO_GOOGLE_CALLBACK,
        json={"code": f"mock_google_code_::{admin_user.email}", "state": "test-state"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["user"]["email"] == admin_user.email
    assert data["user"]["role"] == "ADMIN"


async def test_google_sso_callback_rejects_inactive_user(client, db_session):
    inactive_user = await f.make_user(
        db_session,
        email="disabled.user@company.org",
        status=UserStatus.INACTIVE,
    )

    response = await client.post(
        SSO_GOOGLE_CALLBACK,
        json={"code": f"mock_google_code_::{inactive_user.email}", "state": "test-state"},
    )
    assert response.status_code == 401
