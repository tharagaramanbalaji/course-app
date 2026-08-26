"""Learner actions: content completion and quiz attempts (sections 12 to 19).

Both entry points are transactional. The service stages every write and
commits once at the end, so a submission cannot leave an attempt scored but
module progress stale.
"""

import random
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.progress import ContentProgress
from app.models.quiz_attempt import QuizAttempt, QuizAttemptAnswer
from app.models.user import User
from app.repositories.course import ContentRepository, ModuleRepository
from app.repositories.progress import ContentProgressRepository
from app.repositories.quiz import QuizRepository
from app.repositories.quiz_attempt import QuizAttemptRepository
from app.schemas.attempt import (
    AttemptResultRead,
    AttemptStartRead,
    AttemptSubmit,
    CertificateSummary,
)
from app.schemas.progress import ContentCompletionRead, ModuleProgressRead
from app.schemas.quiz import QuestionLearnerRead
from app.services.enrollment import EnrollmentService
from app.services.module import ModuleService
from app.services.progression import ProgressionService, as_percentage


class LearningService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.modules = ModuleRepository(session)
        self.contents = ContentRepository(session)
        self.quizzes = QuizRepository(session)
        self.content_progress = ContentProgressRepository(session)
        self.attempts = QuizAttemptRepository(session)
        self.enrollments = EnrollmentService(session)
        self.module_service = ModuleService(session)
        self.progression = ProgressionService(session)

    # --- shared access checks ------------------------------------------

    async def _unlocked_module(self, learner: User, course_id: UUID, module_id: UUID):
        """Resolve the whole chain explicitly rather than trusting any single
        id: enrollment, module belongs to course, module unlocked."""
        enrollment = await self.enrollments.require_enrollment(learner, course_id)

        module = await self.modules.get_in_course(module_id, course_id)
        if module is None:
            raise NotFoundError("Module not found in this course.")

        view = await self.module_service.get_for_learner(enrollment, course_id, module_id)
        if not view.unlocked:
            raise BusinessRuleError(
                "This module is locked. Complete the previous module first."
            )
        return enrollment, module

    # --- content completion (section 12) --------------------------------

    async def complete_content(
        self, learner: User, course_id: UUID, module_id: UUID, content_id: UUID
    ) -> ContentCompletionRead:
        """Idempotent: calling it again updates the same row rather than
        inserting a second, and never un-completes anything."""
        enrollment, module = await self._unlocked_module(learner, course_id, module_id)

        content = await self.contents.get_in_module(content_id, module.id)
        if content is None:
            raise NotFoundError("Content not found in this module.")

        row = await self.content_progress.get_for_content(enrollment.id, content.id)
        if row is None:
            row = ContentProgress(enrollment_id=enrollment.id, content_id=content.id)
            self.content_progress.add(row)

        if not row.completed:
            row.completed = True
            row.completed_at = datetime.now(UTC)
        await self.session.flush()

        progress, course_completed, certificate = await self.progression.refresh_after_change(
            enrollment, module
        )
        await self.session.commit()

        return ContentCompletionRead(
            content_id=content.id,
            completed=row.completed,
            completed_at=row.completed_at,
            module=ModuleProgressRead.model_validate(progress),
            module_completed=progress.status.value == "COMPLETED",
            course_completed=course_completed,
            certificate=(
                CertificateSummary.model_validate(certificate) if certificate else None
            ),
        )

    # --- quiz attempts (sections 15 and 16) -----------------------------

    async def start_attempt(
        self, learner: User, course_id: UUID, module_id: UUID
    ) -> AttemptStartRead:
        enrollment, module = await self._unlocked_module(learner, course_id, module_id)

        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")

        loaded = await self.quizzes.get_with_questions(quiz.id)
        if not loaded.questions:
            raise BusinessRuleError("This quiz has no questions yet.")

        already_passed = await self.attempts.exists(
            QuizAttempt.enrollment_id == enrollment.id,
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.passed.is_(True),
        )
        if already_passed:
            raise ConflictError("You have already passed this quiz.")

        # Resuming rather than starting a second attempt, so an abandoned
        # attempt does not silently consume the learner's retry budget.
        attempt = await self.attempts.get_active(enrollment.id, quiz.id)
        if attempt is None:
            used = await self.attempts.count_for_quiz(enrollment.id, quiz.id)
            if quiz.max_attempts is not None and used >= quiz.max_attempts:
                raise BusinessRuleError(
                    f"No attempts remaining. This quiz allows {quiz.max_attempts}."
                )
            attempt = QuizAttempt(
                quiz_id=quiz.id,
                enrollment_id=enrollment.id,
                # Assigned here, never taken from the client.
                attempt_number=await self.attempts.next_attempt_number(
                    enrollment.id, quiz.id
                ),
            )
            self.attempts.add(attempt)
            await self.session.commit()
            await self.session.refresh(attempt)

        questions = [QuestionLearnerRead.model_validate(q) for q in loaded.questions]
        if quiz.randomize_questions:
            random.shuffle(questions)

        used = await self.attempts.count_for_quiz(enrollment.id, quiz.id)
        return AttemptStartRead(
            id=attempt.id,
            quiz_id=quiz.id,
            attempt_number=attempt.attempt_number,
            started_at=attempt.started_at,
            max_attempts=quiz.max_attempts,
            attempts_remaining=(
                None if quiz.max_attempts is None else max(quiz.max_attempts - used, 0)
            ),
            passing_score=quiz.passing_score,
            total_points=sum((q.points for q in loaded.questions), Decimal("0")),
            questions=questions,
        )

    async def submit_attempt(
        self,
        learner: User,
        course_id: UUID,
        module_id: UUID,
        attempt_id: UUID,
        payload: AttemptSubmit,
    ) -> AttemptResultRead:
        """Score a submission and cascade the consequences, in one transaction."""
        enrollment, module = await self._unlocked_module(learner, course_id, module_id)

        attempt = await self.attempts.get_for_enrollment(attempt_id, enrollment.id)
        if attempt is None:
            raise NotFoundError("Attempt not found.")
        if attempt.submitted_at is not None:
            raise ConflictError("This attempt has already been submitted.")

        quiz = await self.quizzes.get_with_questions(attempt.quiz_id)
        if quiz.module_id != module.id:
            raise NotFoundError("Attempt not found.")

        questions = {q.id: q for q in quiz.questions}
        selections = self._validate_selections(payload, questions)

        earned = Decimal("0")
        possible = sum((q.points for q in quiz.questions), Decimal("0"))
        correct_count = 0

        for question_id, answer in selections.items():
            question = questions[question_id]
            # Correctness comes from the database, never the request body.
            is_correct = bool(answer.is_correct)
            points = question.points if is_correct else Decimal("0")
            if is_correct:
                correct_count += 1
                earned += points

            self.session.add(
                QuizAttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=question_id,
                    answer_id=answer.id,
                    is_correct=is_correct,
                    points_earned=points,
                )
            )

        score = as_percentage(earned, possible)
        attempt.score = score
        attempt.passed = score >= quiz.passing_score
        attempt.submitted_at = datetime.now(UTC)
        await self.session.flush()

        progress, course_completed, certificate = await self.progression.refresh_after_change(
            enrollment, module
        )
        await self.session.commit()

        used = await self.attempts.count_for_quiz(enrollment.id, quiz.id)
        return AttemptResultRead(
            attempt_id=attempt.id,
            attempt_number=attempt.attempt_number,
            score=score,
            passed=attempt.passed,
            correct_answers=correct_count,
            total_questions=len(quiz.questions),
            points_earned=earned,
            total_points=possible,
            attempts_remaining=(
                None if quiz.max_attempts is None else max(quiz.max_attempts - used, 0)
            ),
            module_completed=progress.status.value == "COMPLETED",
            course_completed=course_completed,
            certificate=(
                CertificateSummary.model_validate(certificate) if certificate else None
            ),
        )

    @staticmethod
    def _validate_selections(payload: AttemptSubmit, questions: dict):
        """Every question must belong to this quiz, every answer to its own
        question, and no question may be answered twice."""
        seen: dict[UUID, object] = {}

        for selection in payload.answers:
            question = questions.get(selection.question_id)
            if question is None:
                raise BusinessRuleError(
                    "A submitted question does not belong to this quiz.",
                    {"questionId": str(selection.question_id)},
                )
            if selection.question_id in seen:
                raise BusinessRuleError(
                    "A question was answered more than once.",
                    {"questionId": str(selection.question_id)},
                )

            answer = next(
                (a for a in question.answers if a.id == selection.answer_id), None
            )
            if answer is None:
                raise BusinessRuleError(
                    "A submitted answer does not belong to its question.",
                    {"answerId": str(selection.answer_id)},
                )
            seen[selection.question_id] = answer

        missing = set(questions) - set(seen)
        if missing:
            raise BusinessRuleError(
                "Every question must be answered.",
                {"unanswered": sorted(str(q) for q in missing)},
            )
        return seen

    async def list_attempts(
        self, learner: User, course_id: UUID, module_id: UUID
    ) -> list[QuizAttempt]:
        enrollment, module = await self._unlocked_module(learner, course_id, module_id)
        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")
        attempts = await self.attempts.list_for_enrollment(enrollment.id)
        return [a for a in attempts if a.quiz_id == quiz.id]
