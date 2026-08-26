"""Shared pytest fixtures.

The suite runs against in-memory SQLite so it needs no PostgreSQL instance.
Foreign keys are switched on explicitly, because SQLite ignores them by
default and the cascade and RESTRICT rules are worth testing.
"""

import os
from collections.abc import AsyncGenerator

os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite+aiosqlite:///:memory:")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A session against a fresh schema, isolated per test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """An HTTP client whose requests share the test's database session, so
    rows created by a fixture are visible to the endpoint under test."""
    app = create_app()

    async def _use_test_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _use_test_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
