"""Progress data access, always scoped to a single enrollment."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from app.models.content import Content
from app.models.enums import ProgressStatus
from app.models.module import Module
from app.models.progress import ContentProgress, ModuleProgress
from app.repositories.base import BaseRepository


class ContentProgressRepository(BaseRepository[ContentProgress]):
    model = ContentProgress

    async def get_for_content(
        self,
        enrollment_id: UUID,
        content_id: UUID,
    ) -> ContentProgress | None:
        """Look up the existing row so completion stays idempotent."""
        stmt = select(ContentProgress).where(
            ContentProgress.enrollment_id == enrollment_id,
            ContentProgress.content_id == content_id,
        )
        return await self.session.scalar(stmt)

    async def list_for_enrollment(self, enrollment_id: UUID) -> Sequence[ContentProgress]:
        stmt = select(ContentProgress).where(ContentProgress.enrollment_id == enrollment_id)
        return (await self.session.scalars(stmt)).all()

    async def count_completed_in_module(self, enrollment_id: UUID, module_id: UUID) -> int:
        """How many of the module's content items this learner has completed."""
        return await self.count(
            ContentProgress.enrollment_id == enrollment_id,
            ContentProgress.completed.is_(True),
            ContentProgress.content_id.in_(
                select(Content.id).where(Content.module_id == module_id)
            ),
        )


class ModuleProgressRepository(BaseRepository[ModuleProgress]):
    model = ModuleProgress

    async def get_for_module(self, enrollment_id: UUID, module_id: UUID) -> ModuleProgress | None:
        stmt = select(ModuleProgress).where(
            ModuleProgress.enrollment_id == enrollment_id,
            ModuleProgress.module_id == module_id,
        )
        return await self.session.scalar(stmt)

    async def list_for_enrollment(self, enrollment_id: UUID) -> Sequence[ModuleProgress]:
        stmt = (
            select(ModuleProgress)
            .join(Module, Module.id == ModuleProgress.module_id)
            .where(ModuleProgress.enrollment_id == enrollment_id)
            .order_by(Module.display_order)
        )
        return (await self.session.scalars(stmt)).all()

    async def count_completed(self, enrollment_id: UUID) -> int:
        return await self.count(
            ModuleProgress.enrollment_id == enrollment_id,
            ModuleProgress.status == ProgressStatus.COMPLETED,
        )
