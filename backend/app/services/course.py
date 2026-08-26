"""Course lifecycle and ownership rules (section 4)."""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.course import Course
from app.models.enums import CourseStatus
from app.models.user import User
from app.repositories.course import CourseRepository
from app.schemas.common import PaginationParams
from app.schemas.course import CourseCreate, CourseUpdate


class CourseService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.courses = CourseRepository(session)

    async def create_course(self, author: User, payload: CourseCreate) -> Course:
        course = Course(
            **payload.model_dump(),
            created_by=author.id,
            status=CourseStatus.DRAFT,
        )
        self.courses.add(course)
        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def list_courses(
        self,
        viewer: User,
        pagination: PaginationParams,
        *,
        search: str | None = None,
        category: str | None = None,
        status: CourseStatus | None = None,
    ) -> tuple[Sequence[Course], int]:
        """Authors see their own courses; learners see the published catalogue.

        The distinction is applied in the query, so a learner cannot reach
        another author's draft by paging far enough.
        """
        if viewer.role.can_author_courses:
            return await self.courses.list_page(
                limit=pagination.limit,
                offset=pagination.offset,
                owner_id=viewer.id,
                statuses=[status] if status else None,
                search=search,
                category=category,
            )

        return await self.courses.list_page(
            limit=pagination.limit,
            offset=pagination.offset,
            statuses=[CourseStatus.PUBLISHED],
            search=search,
            category=category,
        )

    async def get_course(self, viewer: User, course_id: UUID) -> Course:
        if viewer.role.can_author_courses:
            course = await self.courses.get_owned(course_id, viewer.id)
            if course is None:
                # Not "forbidden": an author must not be able to discover that
                # another author's course exists by probing ids.
                raise NotFoundError("Course not found.")
            return course

        course = await self.courses.get(course_id)
        if course is None or course.status is not CourseStatus.PUBLISHED:
            raise NotFoundError("Course not found.")
        return course

    async def update_course(self, owner: User, course_id: UUID, payload: CourseUpdate) -> Course:
        course = await self._owned_draft(owner, course_id, action="edited")

        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(course, field, value)

        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def delete_course(self, owner: User, course_id: UUID) -> None:
        course = await self._owned_draft(owner, course_id, action="deleted")
        await self.courses.delete(course)
        await self.session.commit()

    async def publish_course(self, owner: User, course_id: UUID) -> Course:
        """Validate the whole course tree, then publish it in one transaction."""
        course = await self.courses.get_for_publication(course_id, owner.id)
        if course is None:
            raise NotFoundError("Course not found.")
        if course.status is not CourseStatus.DRAFT:
            raise BusinessRuleError(
                f"Only a DRAFT course can be published; this course is {course.status.value}."
            )

        problems = _publication_problems(course)
        if problems:
            raise BusinessRuleError(
                "This course is not ready to publish.",
                {"problems": problems},
            )

        course.status = CourseStatus.PUBLISHED
        course.published_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def _owned_draft(self, owner: User, course_id: UUID, *, action: str) -> Course:
        course = await self.courses.get_owned(course_id, owner.id)
        if course is None:
            raise NotFoundError("Course not found.")
        if course.status is not CourseStatus.DRAFT:
            raise BusinessRuleError(
                f"A {course.status.value} course cannot be {action}. "
                "V1 does not support editing after publication."
            )
        return course


def _publication_problems(course: Course) -> list[str]:
    """Every reason the course cannot be published, so the author sees them all
    at once rather than fixing one and hitting the next."""
    problems: list[str] = []

    if not course.modules:
        problems.append("The course has no modules.")

    for module in sorted(course.modules, key=lambda m: m.display_order):
        where = f"Module {module.display_order} ({module.title})"

        if not module.contents:
            problems.append(f"{where} has no content.")

        quiz = module.quiz
        if quiz is None:
            problems.append(f"{where} has no quiz.")
            continue

        if not (0 <= quiz.passing_score <= 100):
            problems.append(f"{where} has an invalid passing score.")
        if not quiz.questions:
            problems.append(f"{where} has a quiz with no questions.")

        for question in sorted(quiz.questions, key=lambda q: q.display_order):
            label = f"{where}, question {question.display_order}"
            if len(question.answers) < 2:
                problems.append(f"{label} needs at least two answers.")
            if not any(answer.is_correct for answer in question.answers):
                problems.append(f"{label} has no correct answer.")

    return problems
