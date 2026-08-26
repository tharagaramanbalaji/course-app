"""User management endpoints (section 3). ADMIN only."""

import pytest

from app.models.enums import UserRole
from tests import factories as f
from tests.factories import DEFAULT_PASSWORD

USERS = "/api/v1/users"


async def _admin_headers(client, db_session):
    await f.make_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    return await f.auth_headers(client, "admin@example.com")


async def test_listing_users_requires_authentication(client):
    assert (await client.get(USERS)).status_code == 401


@pytest.mark.parametrize("role", [UserRole.USER, UserRole.INSTRUCTOR])
async def test_only_admins_may_list_users(client, db_session, role):
    await f.make_user(db_session, email="someone@example.com", role=role)
    headers = await f.auth_headers(client, "someone@example.com")

    response = await client.get(USERS, headers=headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


async def test_the_list_uses_the_paginated_envelope(client, db_session):
    headers = await _admin_headers(client, db_session)
    for index in range(3):
        await f.make_user(db_session, email=f"user{index}@example.com")

    response = await client.get(USERS, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 4  # three learners plus the admin
    assert body["pagination"] == {"page": 1, "limit": 20, "total": 4, "totalPages": 1}


async def test_pagination_splits_the_result(client, db_session):
    headers = await _admin_headers(client, db_session)
    for index in range(5):
        await f.make_user(db_session, email=f"user{index}@example.com")

    response = await client.get(f"{USERS}?page=2&limit=2", headers=headers)

    body = response.json()
    assert len(body["data"]) == 2
    assert body["pagination"] == {"page": 2, "limit": 2, "total": 6, "totalPages": 3}


async def test_the_list_can_be_filtered_by_role_and_search(client, db_session):
    headers = await _admin_headers(client, db_session)
    await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)

    by_role = await client.get(f"{USERS}?role=INSTRUCTOR", headers=headers)
    assert [u["email"] for u in by_role.json()["data"]] == ["ivan@example.com"]

    by_search = await client.get(f"{USERS}?search=lena", headers=headers)
    assert [u["email"] for u in by_search.json()["data"]] == ["lena@example.com"]


async def test_creating_a_user_hashes_the_password(client, db_session):
    headers = await _admin_headers(client, db_session)

    response = await client.post(
        USERS,
        headers=headers,
        json={
            "firstName": "New",
            "lastName": "Person",
            "email": "New.Person@Example.com",
            "password": "SuperSecret1",
            "role": "INSTRUCTOR",
        },
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "new.person@example.com"  # normalised
    assert data["role"] == "INSTRUCTOR"
    assert "password" not in response.text
    assert "$2b$" not in response.text

    # The stored credential works, which proves it was hashed rather than kept.
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "new.person@example.com", "password": "SuperSecret1"},
    )
    assert login.status_code == 200


async def test_duplicate_emails_are_rejected(client, db_session):
    headers = await _admin_headers(client, db_session)
    await f.make_user(db_session, email="taken@example.com")

    response = await client.post(
        USERS,
        headers=headers,
        json={
            "firstName": "Second",
            "lastName": "Claimant",
            "email": "TAKEN@example.com",
            "password": "SuperSecret1",
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


async def test_a_short_password_is_rejected(client, db_session):
    headers = await _admin_headers(client, db_session)

    response = await client.post(
        USERS,
        headers=headers,
        json={
            "firstName": "New",
            "lastName": "Person",
            "email": "new@example.com",
            "password": "short",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_an_unknown_user_is_reported_as_not_found(client, db_session):
    headers = await _admin_headers(client, db_session)

    response = await client.get(f"{USERS}/11111111-1111-1111-1111-111111111111", headers=headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


async def test_a_profile_update_cannot_change_the_role(client, db_session):
    headers = await _admin_headers(client, db_session)
    learner = await f.make_user(db_session, email="lena@example.com")

    response = await client.patch(
        f"{USERS}/{learner.id}",
        headers=headers,
        json={"firstName": "Renamed", "role": "ADMIN"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["firstName"] == "Renamed"
    assert data["role"] == "USER"  # the smuggled role was ignored


async def test_the_role_endpoint_changes_the_role(client, db_session):
    headers = await _admin_headers(client, db_session)
    learner = await f.make_user(db_session, email="lena@example.com")

    response = await client.patch(
        f"{USERS}/{learner.id}/role", headers=headers, json={"role": "INSTRUCTOR"}
    )

    assert response.status_code == 200
    assert response.json()["data"]["role"] == "INSTRUCTOR"


async def test_deactivating_a_user_blocks_their_login(client, db_session):
    headers = await _admin_headers(client, db_session)
    learner = await f.make_user(db_session, email="lena@example.com")

    response = await client.patch(
        f"{USERS}/{learner.id}/status", headers=headers, json={"status": "INACTIVE"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "INACTIVE"

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "lena@example.com", "password": DEFAULT_PASSWORD},
    )
    assert login.status_code == 401
