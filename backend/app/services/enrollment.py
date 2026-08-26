"""Enrollment and the learner's own course list (section 11)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.enums import CourseStatus, EnrollmentSource, EnrollmentStatus
from app.models.user import User
from app.repositories.course import CourseRepository, ModuleRepository
from app.repositories.enrollment import AssignmentRepository, EnrollmentRepository
from app.repositories.progress import ModuleProgressRepository
from app.schemas.enrollment import (
    AssignmentSummary,
    EnrollmentRead,
    MyCourseRead,
    ProgressSummary,
)


class EnrollmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.enrollments = EnrollmentRepository(session)
        self.assignments = AssignmentRepository(session)
        self.courses = CourseRepository(session)
        self.modules = ModuleRepository(session)
        self.progress = ModuleProgressRepository(session)

    async def require_enrollment(self, learner: User, course_id: UUID) -> Enrollment:
        """The learner's enrollment in a course, or 404.

        This is the gate every learner-facing course route passes through:
        without an enrollment there is nothing to see, and saying "not
        found" avoids confirming that the course exists.
        """
        enrollment = await self.enrollments.get_for_user_and_course(learner.id, course_id)
        if enrollment is None:
            raise NotFoundError("You are not enrolled in this course.")
        return enrollment

    async def self_enroll(self, learner: User, course_id: UUID) -> Enrollment:
        course = await self.courses.get(course_id)
        if course is None:
            raise NotFoundError("Course not found.")
        if course.status is not CourseStatus.PUBLISHED:
            raise BusinessRuleError("Only a published course can be joined.")
        if not course.allow_self_enrollment:
            raise BusinessRuleError(
                "This course does not allow self-enrollment. "
                "An administrator or instructor must assign it to you."
            )

        existing = await self.enrollments.get_for_user_and_course(learner.id, course_id)
        if existing is not None:
            raise ConflictError("You are already enrolled in this course.")

        enrollment = Enrollment(
            course_id=course_id,
            user_id=learner.id,
            source=EnrollmentSource.SELF_ENROLLED,
        )
        self.enrollments.add(enrollment)
        await self.session.commit()
        await self.session.refresh(enrollment)
        return enrollment

    async def ensure_enrollment(self, course_id: UUID, user_id: UUID) -> Enrollment:
        """Establish the enrollment behind an assignment.

        Staged, not committed: the caller wraps assignment creation and this
        in one transaction, so an assignment can never exist without the
        enrollment it implies.
        """
        existing = await self.enrollments.get_for_user_and_course(user_id, course_id)
        if existing is not None:
            if existing.status is EnrollmentStatus.CANCELLED:
                existing.status = EnrollmentStatus.ACTIVE
            return existing

        enrollment = Enrollment(
            course_id=course_id,
            user_id=user_id,
            source=EnrollmentSource.ASSIGNMENT,
        )
        self.enrollments.add(enrollment)
        await self.session.flush()
        return enrollment

    async def my_courses(self, learner: User) -> list[MyCourseRead]:
        """Every course this learner is in, with progress and assignment."""
        enrollments = await self.enrollments.list_for_user(learner.id)
        assignments = {a.course_id: a for a in await self.assignments.list_for_user(learner.id)}

        rows: list[MyCourseRead] = []
        for enrollment in enrollments:
            course = await self.courses.get(enrollment.course_id)
            if course is None:
                continue
            rows.append(await self._compose(course, enrollment, assignments.get(course.id)))
        return rows

    async def my_course(self, learner: User, course_id: UUID) -> MyCourseRead:
        enrollment = await self.require_enrollment(learner, course_id)
        course = await self.courses.get(course_id)
        if course is None:
            raise NotFoundError("Course not found.")
        assignment = await self.assignments.get_active(course_id, learner.id)
        return await self._compose(course, enrollment, assignment)

    async def _compose(self, course: Course, enrollment: Enrollment, assignment) -> MyCourseRead:
        return MyCourseRead(
            course_id=course.id,
            title=course.title,
            description=course.description,
            category=course.category,
            thumbnail_url=course.thumbnail_url,
            course_status=course.status,
            enrollment=EnrollmentRead.model_validate(enrollment),
            progress=await self.progress_summary(course.id, enrollment.id),
            assignment=(
                AssignmentSummary.model_validate(assignment) if assignment is not None else None
            ),
        )

    async def progress_summary(self, course_id: UUID, enrollment_id: UUID) -> ProgressSummary:
        """Derived from module progress rows, never stored as a percentage."""
        modules = await self.modules.list_by_course(course_id)
        total = len(modules)
        completed = await self.progress.count_completed(enrollment_id)
        return ProgressSummary(
            total_modules=total,
            completed_modules=completed,
            percent_complete=round(completed / total * 100) if total else 0,
        )
