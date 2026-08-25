"""Assignment and enrollment data access."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from app.models.assignment import Assignment
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.enums import AssignmentStatus, EnrollmentStatus
from app.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository[Assignment]):
    model = Assignment

    async def get_active(self, course_id: UUID, user_id: UUID) -> Assignment | None:
        """An assignment that has not been cancelled, used to avoid duplicates."""
        stmt = select(Assignment).where(
            Assignment.course_id == course_id,
            Assignment.user_id == user_id,
            Assignment.status != AssignmentStatus.CANCELLED,
        )
        return await self.session.scalar(stmt)

    async def list_by_course(self, course_id: UUID) -> Sequence[Assignment]:
        stmt = (
            select(Assignment)
            .where(Assignment.course_id == course_id)
            .order_by(Assignment.assigned_at.desc())
        )
        return (await self.session.scalars(stmt)).all()

    async def list_for_user(self, user_id: UUID) -> Sequence[Assignment]:
        stmt = (
            select(Assignment)
            .where(Assignment.user_id == user_id)
            .order_by(Assignment.assigned_at.desc())
        )
        return (await self.session.scalars(stmt)).all()

    async def list_for_owner(self, owner_id: UUID) -> Sequence[Assignment]:
        """Every assignment across the courses this admin or instructor owns.

        Ownership is derived through ``courses.created_by``, never from
        ``assigned_by``: assigning a course does not confer ownership of it.
        """
        stmt = (
            select(Assignment)
            .join(Course, Course.id == Assignment.course_id)
            .where(Course.created_by == owner_id)
            .order_by(Assignment.assigned_at.desc())
        )
        return (await self.session.scalars(stmt)).all()


class EnrollmentRepository(BaseRepository[Enrollment]):
    model = Enrollment

    async def get_for_user_and_course(self, user_id: UUID, course_id: UUID) -> Enrollment | None:
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
        return await self.session.scalar(stmt)

    async def get_owned_by_user(self, enrollment_id: UUID, user_id: UUID) -> Enrollment | None:
        """Fetch an enrollment only if it belongs to the given learner."""
        stmt = select(Enrollment).where(
            Enrollment.id == enrollment_id,
            Enrollment.user_id == user_id,
        )
        return await self.session.scalar(stmt)

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        status: EnrollmentStatus | None = None,
    ) -> Sequence[Enrollment]:
        stmt = select(Enrollment).where(Enrollment.user_id == user_id)
        if status is not None:
            stmt = stmt.where(Enrollment.status == status)
        return (await self.session.scalars(stmt.order_by(Enrollment.started_at.desc()))).all()

    async def list_by_course(self, course_id: UUID) -> Sequence[Enrollment]:
        stmt = select(Enrollment).where(Enrollment.course_id == course_id)
        return (await self.session.scalars(stmt.order_by(Enrollment.started_at.desc()))).all()

    async def list_for_owner(self, owner_id: UUID) -> Sequence[Enrollment]:
        """Every enrollment across the courses this admin or instructor owns."""
        stmt = (
            select(Enrollment)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Course.created_by == owner_id)
            .order_by(Enrollment.started_at.desc())
        )
        return (await self.session.scalars(stmt)).all()
