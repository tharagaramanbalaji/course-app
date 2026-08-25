"""Generic async data access.

Repositories own queries only. Business rules -- ownership checks, lifecycle
transitions, scoring -- belong in the service layer; what lives here is the
SQL needed to fetch and persist rows, including the filtering that must never
be left to the client.
"""

from collections.abc import Sequence
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """CRUD shared by every entity."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, entity_id: UUID) -> ModelT | None:
        return await self.session.get(self.model, entity_id)

    async def list_all(self, *, limit: int | None = None, offset: int = 0) -> Sequence[ModelT]:
        stmt = select(self.model).offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        return (await self.session.scalars(stmt)).all()

    async def count(self, *criteria: Any) -> int:
        stmt = select(func.count()).select_from(self.model).where(*criteria)
        return (await self.session.scalar(stmt)) or 0

    async def exists(self, *criteria: Any) -> bool:
        stmt = select(self.model.id).where(*criteria).limit(1)
        return (await self.session.scalar(stmt)) is not None

    def add(self, entity: ModelT) -> ModelT:
        """Stage an insert. The caller commits, so a whole operation is one
        transaction (quiz submission touches five tables)."""
        self.session.add(entity)
        return entity

    async def delete(self, entity: ModelT) -> None:
        await self.session.delete(entity)

    async def flush(self) -> None:
        """Force pending SQL so server defaults and generated ids are available."""
        await self.session.flush()
