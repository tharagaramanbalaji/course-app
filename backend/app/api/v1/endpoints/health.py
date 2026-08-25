"""Liveness and readiness endpoints."""

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.exceptions import ServiceUnavailableError

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"status": "ok"}


@router.get("/health/db")
async def health_db(db: DbSession) -> dict[str, str]:
    """Readiness: the database is reachable."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:  # driver + SQLAlchemy errors both surface here
        cause = getattr(exc, "orig", exc)
        raise ServiceUnavailableError(
            "Database is not reachable.",
            {"reason": type(cause).__name__},
        ) from exc
    return {"status": "ok", "database": "reachable"}
