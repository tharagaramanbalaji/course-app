"""Authentication endpoints (section 2)."""

import pytest

from app.models.enums import UserRole, UserStatus
from tests import factories as f
from tests.factories import DEFAULT_PASSWORD

LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"


async def test_login_returns_tokens_and_the_user(client, db_session):
    await f.make_user(db_session, email="ada@example.com", role=UserRole.ADMIN)

    response = await client.post(
        LOGIN, json={"email": "ada@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["accessToken"]
    assert data["refreshToken"]
    assert data["user"]["email"] == "ada@example.com"
    assert data["user"]["role"] == "ADMIN"


async def test_login_never_returns_the_password_hash(client, db_session):
    await f.make_user(db_session, email="ada@example.com")

    response = await client.post(
        LOGIN, json={"email": "ada@example.com", "password": DEFAULT_PASSWORD}
    )

    body = response.text
    assert "passwordHash" not in body
    assert "password_hash" not in body
    assert "$2b$" not in body


async def test_login_is_case_insensitive_on_email(client, db_session):
    await f.make_user(db_session, email="Ada@Example.com")

    response = await client.post(
        LOGIN, json={"email": "ADA@EXAMPLE.COM", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200


@pytest.mark.parametrize(
    "email,password",
    [
        ("ada@example.com", "wrong-password"),
        ("nobody@example.com", DEFAULT_PASSWORD),
    ],
    ids=["wrong password", "unknown email"],
)
async def test_bad_credentials_do_not_reveal_whether_the_email_exists(
    client, db_session, email, password
):
    await f.make_user(db_session, email="ada@example.com")

    response = await client.post(LOGIN, json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Incorrect email or password."


async def test_inactive_users_cannot_log_in(client, db_session):
    await f.make_user(db_session, email="gone@example.com", status=UserStatus.INACTIVE)

    response = await client.post(
        LOGIN, json={"email": "gone@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 401
    # Same message as a wrong password: no account enumeration.
    assert response.json()["error"]["message"] == "Incorrect email or password."


async def test_me_requires_a_token(client):
    response = await client.get(ME)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_me_rejects_a_garbage_token(client):
    response = await client.get(ME, headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401


async def test_me_returns_the_authenticated_user(client, db_session):
    await f.make_user(db_session, email="ada@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ada@example.com")

    response = await client.get(ME, headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == "ada@example.com"
    assert data["role"] == "INSTRUCTOR"
    assert data["status"] == "ACTIVE"


async def test_refresh_issues_a_new_access_token(client, db_session):
    await f.make_user(db_session, email="ada@example.com")
    login = await client.post(
        LOGIN, json={"email": "ada@example.com", "password": DEFAULT_PASSWORD}
    )
    refresh_token = login.json()["data"]["refreshToken"]

    response = await client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})

    assert response.status_code == 200
    assert response.json()["data"]["accessToken"]


async def test_an_access_token_cannot_be_used_to_refresh(client, db_session):
    await f.make_user(db_session, email="ada@example.com")
    login = await client.post(
        LOGIN, json={"email": "ada@example.com", "password": DEFAULT_PASSWORD}
    )
    access_token = login.json()["data"]["accessToken"]

    response = await client.post("/api/v1/auth/refresh", json={"refreshToken": access_token})

    assert response.status_code == 401


async def test_logout_invalidates_the_refresh_token(client, db_session):
    await f.make_user(db_session, email="ada@example.com")
    login = await client.post(
        LOGIN, json={"email": "ada@example.com", "password": DEFAULT_PASSWORD}
    )
    tokens = login.json()["data"]
    headers = {"Authorization": f"Bearer {tokens['accessToken']}"}

    logout = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204

    reused = await client.post(
        "/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]}
    )
    assert reused.status_code == 401
