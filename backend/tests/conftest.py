"""Shared pytest fixtures.

The default test database is an in-memory SQLite instance so the suite runs
without Postgres. Tests that exercise Postgres-specific behaviour should set
DATABASE_URL_OVERRIDE to a real Postgres URL.
"""

import os
from collections.abc import AsyncGenerator

os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite+aiosqlite:///:memory:")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import create_app  # noqa: E402


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
