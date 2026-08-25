"""Quiz attempt data access."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.quiz_attempt import QuizAttempt, QuizAttemptAnswer
from app.repositories.base import BaseRepository


class QuizAttemptRepository(BaseRepository[QuizAttempt]):
    model = QuizAttempt

    async def get_for_enrollment(
        self,
        attempt_id: UUID,
        enrollment_id: UUID,
    ) -> QuizAttempt | None:
        """Fetch an attempt only if it belongs to this enrollment."""
        stmt = select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.enrollment_id == enrollment_id,
        )
        return await self.session.scalar(stmt)

    async def count_for_quiz(self, enrollment_id: UUID, quiz_id: UUID) -> int:
        """Attempts used so far, which is what max_attempts is checked against."""
        return await self.count(
            QuizAttempt.enrollment_id == enrollment_id,
            QuizAttempt.quiz_id == quiz_id,
        )

    async def next_attempt_number(self, enrollment_id: UUID, quiz_id: UUID) -> int:
        """The attempt number is assigned here, never taken from the client."""
        stmt = select(func.max(QuizAttempt.attempt_number)).where(
            QuizAttempt.enrollment_id == enrollment_id,
            QuizAttempt.quiz_id == quiz_id,
        )
        return ((await self.session.scalar(stmt)) or 0) + 1

    async def get_active(self, enrollment_id: UUID, quiz_id: UUID) -> QuizAttempt | None:
        """An attempt that was started but not yet submitted."""
        stmt = select(QuizAttempt).where(
            QuizAttempt.enrollment_id == enrollment_id,
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.submitted_at.is_(None),
        )
        return await self.session.scalar(stmt)

    async def list_for_enrollment(self, enrollment_id: UUID) -> Sequence[QuizAttempt]:
        stmt = (
            select(QuizAttempt)
            .where(QuizAttempt.enrollment_id == enrollment_id)
            .order_by(QuizAttempt.started_at.desc())
        )
        return (await self.session.scalars(stmt)).all()

    async def list_passed(self, enrollment_id: UUID) -> Sequence[QuizAttempt]:
        """Passed attempts, the input to the final course score."""
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.enrollment_id == enrollment_id,
                QuizAttempt.passed.is_(True),
            )
            .options(selectinload(QuizAttempt.answers))
        )
        return (await self.session.scalars(stmt)).all()


class QuizAttemptAnswerRepository(BaseRepository[QuizAttemptAnswer]):
    model = QuizAttemptAnswer

    async def list_for_attempt(self, attempt_id: UUID) -> Sequence[QuizAttemptAnswer]:
        stmt = select(QuizAttemptAnswer).where(QuizAttemptAnswer.attempt_id == attempt_id)
        return (await self.session.scalars(stmt)).all()
