"""Course, module and content data access.

Ownership filtering happens here, in the query, rather than after the fact:
a caller that asks for a course it does not own gets nothing back.
"""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.course import Course
from app.models.enums import CourseStatus
from app.models.module import Module
from app.models.quiz import Question, Quiz
from app.repositories.base import BaseRepository


class CourseRepository(BaseRepository[Course]):
    model = Course

    async def get_owned(self, course_id: UUID, owner_id: UUID | None) -> Course | None:
        """Fetch a course, optionally restricted to a given owner.

        ``owner_id=None`` means no ownership restriction: an ADMIN reaches
        any course, an INSTRUCTOR only their own (the caller decides which
        by what it passes here - see ``AuthoringGuard``).
        """
        stmt = select(Course).where(Course.id == course_id)
        if owner_id is not None:
            stmt = stmt.where(Course.created_by == owner_id)
        return await self.session.scalar(stmt)

    async def get_with_structure(self, course_id: UUID) -> Course | None:
        """Load a course with its modules, contents and quizzes in one round trip."""
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.modules).selectinload(Module.contents),
                selectinload(Course.modules).selectinload(Module.quiz),
            )
        )
        return await self.session.scalar(stmt)

    async def get_for_publication(self, course_id: UUID, owner_id: UUID | None) -> Course | None:
        """The whole course tree, optionally owner-scoped, for publication
        validation. ``owner_id=None`` means no ownership restriction."""
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.modules).selectinload(Module.contents),
                selectinload(Course.modules)
                .selectinload(Module.quiz)
                .selectinload(Quiz.questions)
                .selectinload(Question.answers),
            )
        )
        if owner_id is not None:
            stmt = stmt.where(Course.created_by == owner_id)
        return await self.session.scalar(stmt)

    async def list_by_owner(
        self,
        owner_id: UUID,
        *,
        status: CourseStatus | None = None,
    ) -> Sequence[Course]:
        stmt = select(Course).where(Course.created_by == owner_id)
        if status is not None:
            stmt = stmt.where(Course.status == status)
        return (await self.session.scalars(stmt.order_by(Course.created_at.desc()))).all()

    async def list_catalogue(
        self,
        *,
        category: str | None = None,
        self_enrollable_only: bool = False,
    ) -> Sequence[Course]:
        """Courses a learner may browse: published only."""
        stmt = select(Course).where(Course.status == CourseStatus.PUBLISHED)
        if category is not None:
            stmt = stmt.where(Course.category == category)
        if self_enrollable_only:
            stmt = stmt.where(Course.allow_self_enrollment.is_(True))
        return (await self.session.scalars(stmt.order_by(Course.title))).all()


    async def list_page(
        self,
        *,
        limit: int,
        offset: int,
        owner_id: UUID | None = None,
        statuses: list[CourseStatus] | None = None,
        search: str | None = None,
        category: str | None = None,
    ) -> tuple[Sequence[Course], int]:
        """One page of courses plus the unpaginated total.

        ``owner_id`` scopes the query to an author's own courses; leaving it
        out with ``statuses=[PUBLISHED]`` gives the learner catalogue.
        """
        filters = []
        if owner_id is not None:
            filters.append(Course.created_by == owner_id)
        if statuses:
            filters.append(Course.status.in_(statuses))
        if category:
            filters.append(Course.category == category)
        if search:
            pattern = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(Course.title).like(pattern),
                    func.lower(Course.description).like(pattern),
                )
            )

        total = await self.session.scalar(
            select(func.count()).select_from(Course).where(*filters)
        )
        rows = await self.session.scalars(
            select(Course)
            .where(*filters)
            .order_by(Course.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return rows.all(), total or 0


class ModuleRepository(BaseRepository[Module]):
    model = Module

    async def list_by_course(self, course_id: UUID) -> Sequence[Module]:
        stmt = select(Module).where(Module.course_id == course_id).order_by(Module.display_order)
        return (await self.session.scalars(stmt)).all()

    async def get_in_course(self, module_id: UUID, course_id: UUID) -> Module | None:
        """Guards against a module id from a different course being passed in."""
        stmt = select(Module).where(Module.id == module_id, Module.course_id == course_id)
        return await self.session.scalar(stmt)

    async def next_display_order(self, course_id: UUID) -> int:
        stmt = select(Module.display_order).where(Module.course_id == course_id)
        orders = (await self.session.scalars(stmt)).all()
        return max(orders, default=0) + 1


class ContentRepository(BaseRepository[Content]):
    model = Content

    async def list_by_module(self, module_id: UUID) -> Sequence[Content]:
        stmt = select(Content).where(Content.module_id == module_id).order_by(Content.display_order)
        return (await self.session.scalars(stmt)).all()

    async def get_in_module(self, content_id: UUID, module_id: UUID) -> Content | None:
        stmt = select(Content).where(Content.id == content_id, Content.module_id == module_id)
        return await self.session.scalar(stmt)

    async def next_display_order(self, module_id: UUID) -> int:
        stmt = select(Content.display_order).where(Content.module_id == module_id)
        orders = (await self.session.scalars(stmt)).all()
        return max(orders, default=0) + 1
