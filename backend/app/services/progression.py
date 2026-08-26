"""Derived progression: module completion, course completion, certificates.

This is the only place module and course completion are decided. Both are
derived from facts already in the database -- which content the learner has
opened, and which quiz attempts passed -- so no client can assert them.

Nothing here commits. Callers wrap a whole operation (content completion or
quiz submission) in one transaction, so progress can never be left half
updated: section 30.
"""

import secrets
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.enrollment import Enrollment
from app.models.enums import EnrollmentStatus, ProgressStatus
from app.models.module import Module
from app.models.progress import ModuleProgress
from app.models.quiz_attempt import QuizAttempt
from app.repositories.certificate import CertificateRepository
from app.repositories.course import ContentRepository, CourseRepository, ModuleRepository
from app.repositories.progress import ContentProgressRepository, ModuleProgressRepository
from app.repositories.quiz import QuizRepository
from app.repositories.quiz_attempt import QuizAttemptRepository
from app.repositories.user import UserRepository

TWO_PLACES = Decimal("0.01")


def as_percentage(earned: Decimal, possible: Decimal) -> Decimal:
    """Points-based percentage, rounded to two places for display."""
    if possible <= 0:
        return Decimal("0.00")
    return (earned / possible * 100).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class ProgressionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.courses = CourseRepository(session)
        self.modules = ModuleRepository(session)
        self.contents = ContentRepository(session)
        self.quizzes = QuizRepository(session)
        self.content_progress = ContentProgressRepository(session)
        self.module_progress = ModuleProgressRepository(session)
        self.attempts = QuizAttemptRepository(session)
        self.certificates = CertificateRepository(session)
        self.users = UserRepository(session)

    # --- module --------------------------------------------------------

    async def recalculate_module(
        self, enrollment: Enrollment, module: Module
    ) -> ModuleProgress:
        """Recompute one module's state from content progress and attempts.

        A module with no content, or no quiz, satisfies that half of the rule
        vacuously -- there is nothing left to do.
        """
        row = await self.module_progress.get_for_module(enrollment.id, module.id)
        if row is None:
            row = ModuleProgress(enrollment_id=enrollment.id, module_id=module.id)
            self.module_progress.add(row)
            await self.session.flush()

        contents = await self.contents.list_by_module(module.id)
        completed_content = await self.content_progress.count_completed_in_module(
            enrollment.id, module.id
        )
        row.content_completed = completed_content >= len(contents)

        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            row.quiz_passed = True
        else:
            row.quiz_passed = await self.attempts.exists(
                QuizAttempt.enrollment_id == enrollment.id,
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.passed.is_(True),
            )

        if row.content_completed and row.quiz_passed:
            if row.status is not ProgressStatus.COMPLETED:
                row.status = ProgressStatus.COMPLETED
                row.completed_at = datetime.now(UTC)
        elif completed_content > 0 or row.quiz_passed:
            row.status = ProgressStatus.IN_PROGRESS
            row.completed_at = None
        else:
            row.status = ProgressStatus.NOT_STARTED
            row.completed_at = None

        await self.session.flush()
        return row

    # --- course --------------------------------------------------------

    async def recalculate_course(
        self, enrollment: Enrollment
    ) -> tuple[bool, Certificate | None]:
        """Complete the course if every module is done, and issue the
        certificate. Returns (course_completed, certificate)."""
        modules = await self.modules.list_by_course(enrollment.course_id)
        if not modules:
            return False, None

        rows = await self.module_progress.list_for_enrollment(enrollment.id)
        completed = {
            row.module_id for row in rows if row.status is ProgressStatus.COMPLETED
        }
        if not all(module.id in completed for module in modules):
            return False, None

        if enrollment.status is not EnrollmentStatus.COMPLETED:
            enrollment.status = EnrollmentStatus.COMPLETED
            enrollment.completed_at = datetime.now(UTC)
            await self.session.flush()

        certificate = await self.issue_certificate(enrollment)
        return True, certificate

    # --- final score ---------------------------------------------------

    async def final_course_score(self, enrollment: Enrollment) -> Decimal:
        """Aggregate across module quizzes, counting each quiz once.

        Retries must not be double-counted, so exactly one attempt per quiz
        contributes: the best passing attempt for that quiz.
        """
        modules = await self.modules.list_by_course(enrollment.course_id)

        total_earned = Decimal("0")
        total_possible = Decimal("0")

        for module in modules:
            quiz = await self.quizzes.get_by_module(module.id)
            if quiz is None:
                continue

            attempt = await self._best_passing_attempt(enrollment.id, quiz.id)
            if attempt is None:
                continue

            loaded = await self.quizzes.get_with_questions(quiz.id)
            possible = sum((q.points for q in loaded.questions), Decimal("0"))
            if possible <= 0:
                continue

            earned = sum(
                (answer.points_earned for answer in attempt.answers), Decimal("0")
            )
            total_earned += earned
            total_possible += possible

        return as_percentage(total_earned, total_possible)

    async def _best_passing_attempt(
        self, enrollment_id: UUID, quiz_id: UUID
    ) -> QuizAttempt | None:
        passed = await self.attempts.list_passed(enrollment_id)
        candidates = [a for a in passed if a.quiz_id == quiz_id]
        if not candidates:
            return None
        return max(candidates, key=lambda a: (a.score or Decimal("0"), a.attempt_number))

    # --- certificate ---------------------------------------------------

    async def issue_certificate(self, enrollment: Enrollment) -> Certificate:
        """Idempotent: one certificate per enrollment, ever.

        The participant and course names are copied in rather than joined, so
        a later rename cannot rewrite an issued certificate.
        """
        existing = await self.certificates.get_by_enrollment(enrollment.id)
        if existing is not None:
            return existing

        learner = await self.users.get(enrollment.user_id)
        course = await self.courses.get(enrollment.course_id)

        certificate = Certificate(
            certificate_number=await self._unique_certificate_number(),
            enrollment_id=enrollment.id,
            participant_name=learner.full_name,
            course_name=course.title,
            completion_date=enrollment.completed_at or datetime.now(UTC),
            final_score=await self.final_course_score(enrollment),
        )
        self.certificates.add(certificate)
        await self.session.flush()
        return certificate

    async def _unique_certificate_number(self) -> str:
        """Random rather than sequential, so a number cannot be guessed from
        another one -- verification is a public endpoint."""
        year = datetime.now(UTC).year
        for _ in range(10):
            candidate = f"CERT-{year}-{secrets.token_hex(4).upper()}"
            if not await self.certificates.number_exists(candidate):
                return candidate
        raise RuntimeError("Could not allocate a unique certificate number.")

    # --- shared entry point --------------------------------------------

    async def refresh_after_change(
        self, enrollment: Enrollment, module: Module
    ) -> tuple[ModuleProgress, bool, Certificate | None]:
        """Recompute the module, then the course, after any learner action."""
        row = await self.recalculate_module(enrollment, module)
        course_completed, certificate = await self.recalculate_course(enrollment)
        return row, course_completed, certificate
