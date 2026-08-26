"""Assignment rules (section 10).

Assigning a course establishes the learner's enrollment in the same
transaction, so an assignment can never exist without the participation it
implies. Cancellation is preferred to deletion: assignments are part of the
record of who was asked to take what.
"""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.assignment import Assignment
from app.models.enums import AssignmentStatus, CourseStatus, UserRole
from app.models.user import User
from app.repositories.enrollment import AssignmentRepository
from app.repositories.user import UserRepository
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.services.authoring import AuthoringGuard
from app.services.enrollment import EnrollmentService


class AssignmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.guard = AuthoringGuard(session)
        self.assignments = AssignmentRepository(session)
        self.users = UserRepository(session)
        self.enrollments = EnrollmentService(session)

    async def create_assignment(
        self, author: User, course_id: UUID, payload: AssignmentCreate
    ) -> Assignment:
        course = await self.guard.course(author, course_id)
        if course.status is not CourseStatus.PUBLISHED:
            raise BusinessRuleError(
                f"Only a published course can be assigned; this course is {course.status.value}."
            )

        target = await self.users.get(payload.user_id)
        if target is None:
            raise NotFoundError("User not found.")
        if target.role is not UserRole.USER:
            raise BusinessRuleError(
                "Courses can only be assigned to a user with the USER role."
            )

        if await self.assignments.get_active(course_id, target.id) is not None:
            raise ConflictError("This user already has an active assignment for this course.")

        assignment = Assignment(
            course_id=course_id,
            user_id=target.id,
            assigned_by=author.id,
        )
        if payload.due_date is not None:
            assignment.due_date = payload.due_date
        self.assignments.add(assignment)

        # Same transaction: the assignment and the enrollment land together.
        await self.enrollments.ensure_enrollment(course_id, target.id)

        await self.session.commit()
        await self.session.refresh(assignment)
        return assignment

    async def list_for_course(self, author: User, course_id: UUID) -> Sequence[Assignment]:
        await self.guard.course(author, course_id)
        return await self.assignments.list_by_course(course_id)

    async def get_assignment(self, caller: User, assignment_id: UUID) -> Assignment:
        """Authors reach assignments on courses they own; a learner reaches
        only their own."""
        assignment = await self.assignments.get(assignment_id)
        if assignment is None:
            raise NotFoundError("Assignment not found.")

        if caller.role.can_author_courses:
            await self.guard.course(caller, assignment.course_id)
            return assignment

        if assignment.user_id != caller.id:
            raise NotFoundError("Assignment not found.")
        return assignment

    async def update_assignment(
        self, author: User, assignment_id: UUID, payload: AssignmentUpdate
    ) -> Assignment:
        assignment = await self._owned_assignment(author, assignment_id)

        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(assignment, field, value)

        await self.session.commit()
        await self.session.refresh(assignment)
        return assignment

    async def cancel_assignment(self, author: User, assignment_id: UUID) -> Assignment:
        """Cancels rather than deletes: the historical record stays intact,
        and so does any progress the learner has already made."""
        assignment = await self._owned_assignment(author, assignment_id)

        if assignment.status is AssignmentStatus.COMPLETED:
            raise BusinessRuleError("A completed assignment cannot be cancelled.")

        assignment.status = AssignmentStatus.CANCELLED
        await self.session.commit()
        await self.session.refresh(assignment)
        return assignment

    async def _owned_assignment(self, author: User, assignment_id: UUID) -> Assignment:
        assignment = await self.assignments.get(assignment_id)
        if assignment is None:
            raise NotFoundError("Assignment not found.")
        # Ownership comes from the course, not from who created the
        # assignment: assigning someone else's course confers nothing.
        await self.guard.course(author, assignment.course_id)
        return assignment
