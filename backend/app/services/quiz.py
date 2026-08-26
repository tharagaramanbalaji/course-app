"""Quiz, question and answer authoring (sections 7 to 9).

The learner-facing reads return schemas that have no ``isCorrect`` field,
so correctness cannot leak by forgetting to exclude it.
"""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enrollment import Enrollment
from app.models.quiz import Answer, Question, Quiz
from app.models.user import User
from app.repositories.quiz import AnswerRepository, QuestionRepository, QuizRepository
from app.repositories.quiz_attempt import QuizAttemptRepository
from app.schemas.quiz import (
    AnswerCreate,
    AnswerUpdate,
    QuestionCreate,
    QuestionLearnerRead,
    QuestionReorder,
    QuestionUpdate,
    QuizCreate,
    QuizLearnerRead,
    QuizUpdate,
)
from app.services.authoring import AuthoringGuard, apply_order, validate_reorder


class QuizService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.guard = AuthoringGuard(session)
        self.quizzes = QuizRepository(session)
        self.questions = QuestionRepository(session)
        self.answers = AnswerRepository(session)
        self.attempts = QuizAttemptRepository(session)

    # --- quiz ----------------------------------------------------------

    async def create_quiz(
        self, author: User, course_id: UUID, module_id: UUID, payload: QuizCreate
    ) -> Quiz:
        module = await self.guard.draft_module(author, course_id, module_id)

        if await self.quizzes.get_by_module(module.id) is not None:
            raise ConflictError("This module already has a quiz. V1 allows one per module.")

        quiz = Quiz(module_id=module.id, **payload.model_dump())
        self.quizzes.add(quiz)
        await self.session.commit()
        # Reload eagerly: QuizRead includes questions, and a lazy load
        # outside the async context raises MissingGreenlet.
        return await self.quizzes.get_with_questions(quiz.id)

    async def get_for_author(self, author: User, course_id: UUID, module_id: UUID) -> Quiz:
        module = await self.guard.module(author, course_id, module_id)
        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")
        return await self.quizzes.get_with_questions(quiz.id)

    async def update_quiz(
        self, author: User, course_id: UUID, module_id: UUID, payload: QuizUpdate
    ) -> Quiz:
        module = await self.guard.draft_module(author, course_id, module_id)
        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")

        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(quiz, field, value)

        await self.session.commit()
        return await self.quizzes.get_with_questions(quiz.id)

    async def delete_quiz(self, author: User, course_id: UUID, module_id: UUID) -> None:
        module = await self.guard.draft_module(author, course_id, module_id)
        quiz = await self.quizzes.get_by_module(module.id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")
        await self.quizzes.delete(quiz)
        await self.session.commit()

    async def get_for_learner(self, enrollment: Enrollment, module_id: UUID) -> QuizLearnerRead:
        """Configuration only, with this learner's attempt budget."""
        quiz = await self.quizzes.get_by_module(module_id)
        if quiz is None:
            raise NotFoundError("This module has no quiz.")

        used = await self.attempts.count_for_quiz(enrollment.id, quiz.id)
        remaining = None if quiz.max_attempts is None else max(quiz.max_attempts - used, 0)

        return QuizLearnerRead(
            id=quiz.id,
            title=quiz.title,
            passing_score=quiz.passing_score,
            max_attempts=quiz.max_attempts,
            randomize_questions=quiz.randomize_questions,
            attempts_used=used,
            attempts_remaining=remaining,
        )

    async def require_learner_quiz(self, learner: User, quiz_id: UUID) -> Quiz:
        """Prove a learner may see this quiz.

        Addressing a quiz by id alone still has to satisfy every rule the
        nested routes enforce: enrolled in the course, and the module
        unlocked by the sequential rule.
        """
        from app.services.enrollment import EnrollmentService
        from app.services.module import ModuleService

        quiz = await self.quizzes.get_with_course(quiz_id)
        if quiz is None:
            raise NotFoundError("Quiz not found.")

        course_id = quiz.module.course_id
        enrollment = await EnrollmentService(self.session).require_enrollment(learner, course_id)
        module = await ModuleService(self.session).get_for_learner(
            enrollment, course_id, quiz.module_id
        )
        if not module.unlocked:
            raise NotFoundError("This module is locked. Complete the previous module first.")
        return quiz

    async def require_learner_question(self, learner: User, question_id: UUID) -> Question:
        question = await self.questions.get_with_course(question_id)
        if question is None:
            raise NotFoundError("Question not found.")
        await self.require_learner_quiz(learner, question.quiz_id)
        return question

    # --- questions -----------------------------------------------------

    async def create_question(
        self, author: User, quiz_id: UUID, payload: QuestionCreate
    ) -> Question:
        quiz = await self.guard.draft_quiz(author, quiz_id)

        display_order = payload.display_order
        if display_order is None:
            display_order = await self.questions.next_display_order(quiz.id)
        else:
            await self._require_free_question_position(quiz.id, display_order)

        question = Question(
            quiz_id=quiz.id,
            question_text=payload.question_text,
            points=payload.points,
            display_order=display_order,
        )
        self.questions.add(question)
        await self.session.commit()
        return await self.questions.get_with_course(question.id)

    async def list_questions_for_author(self, author: User, quiz_id: UUID) -> Sequence[Question]:
        quiz = await self.guard.quiz(author, quiz_id)
        return await self.questions.list_by_quiz(quiz.id)

    async def get_question_for_author(
        self, author: User, quiz_id: UUID, question_id: UUID
    ) -> Question:
        await self.guard.quiz(author, quiz_id)
        question = await self.questions.get_in_quiz(question_id, quiz_id)
        if question is None:
            raise NotFoundError("Question not found in this quiz.")
        return await self.questions.get_with_course(question.id)

    async def update_question(
        self, author: User, quiz_id: UUID, question_id: UUID, payload: QuestionUpdate
    ) -> Question:
        quiz = await self.guard.draft_quiz(author, quiz_id)
        question = await self.questions.get_in_quiz(question_id, quiz.id)
        if question is None:
            raise NotFoundError("Question not found in this quiz.")

        changes = payload.model_dump(exclude_unset=True)
        new_order = changes.pop("display_order", None)
        if new_order is not None and new_order != question.display_order:
            await self._require_free_question_position(quiz.id, new_order)
            question.display_order = new_order

        for field, value in changes.items():
            if value is not None:
                setattr(question, field, value)

        await self.session.commit()
        return await self.questions.get_with_course(question.id)

    async def delete_question(self, author: User, quiz_id: UUID, question_id: UUID) -> None:
        quiz = await self.guard.draft_quiz(author, quiz_id)
        question = await self.questions.get_in_quiz(question_id, quiz.id)
        if question is None:
            raise NotFoundError("Question not found in this quiz.")
        await self.questions.delete(question)
        await self.session.commit()

    async def reorder_questions(
        self, author: User, quiz_id: UUID, payload: QuestionReorder
    ) -> Sequence[Question]:
        quiz = await self.guard.draft_quiz(author, quiz_id)
        questions = list(await self.questions.list_by_quiz(quiz.id))

        validate_reorder([q.id for q in questions], payload.question_ids, noun="question")
        await apply_order(self.session, questions, payload.question_ids)

        await self.session.commit()
        return await self.questions.list_by_quiz(quiz.id)

    async def list_questions_for_learner(self, quiz_id: UUID) -> list[QuestionLearnerRead]:
        """Questions and options with no correctness information at all."""
        questions = await self.questions.list_by_quiz(quiz_id)
        return [QuestionLearnerRead.model_validate(question) for question in questions]

    async def _require_free_question_position(self, quiz_id: UUID, display_order: int) -> None:
        taken = await self.questions.exists(
            Question.quiz_id == quiz_id, Question.display_order == display_order
        )
        if taken:
            raise ConflictError(
                f"Another question already occupies position {display_order}. "
                "Use the reorder endpoint to move questions around."
            )

    # --- answers -------------------------------------------------------

    async def create_answer(
        self, author: User, question_id: UUID, payload: AnswerCreate
    ) -> Answer:
        question = await self.guard.draft_question(author, question_id)

        display_order = payload.display_order
        if display_order is None:
            display_order = await self.answers.next_display_order(question.id)
        else:
            await self._require_free_answer_position(question.id, display_order)

        answer = Answer(
            question_id=question.id,
            answer_text=payload.answer_text,
            is_correct=payload.is_correct,
            display_order=display_order,
        )
        self.answers.add(answer)
        await self.session.commit()
        await self.session.refresh(answer)
        return answer

    async def list_answers_for_author(self, author: User, question_id: UUID) -> Sequence[Answer]:
        question = await self.guard.question(author, question_id)
        return await self.answers.list_by_question(question.id)

    async def update_answer(
        self, author: User, question_id: UUID, answer_id: UUID, payload: AnswerUpdate
    ) -> Answer:
        question = await self.guard.draft_question(author, question_id)
        answer = await self.answers.get_in_question(answer_id, question.id)
        if answer is None:
            raise NotFoundError("Answer not found in this question.")

        changes = payload.model_dump(exclude_unset=True)
        new_order = changes.pop("display_order", None)
        if new_order is not None and new_order != answer.display_order:
            await self._require_free_answer_position(question.id, new_order)
            answer.display_order = new_order

        for field, value in changes.items():
            if value is not None:
                setattr(answer, field, value)

        await self.session.commit()
        await self.session.refresh(answer)
        return answer

    async def delete_answer(self, author: User, question_id: UUID, answer_id: UUID) -> None:
        question = await self.guard.draft_question(author, question_id)
        answer = await self.answers.get_in_question(answer_id, question.id)
        if answer is None:
            raise NotFoundError("Answer not found in this question.")
        await self.answers.delete(answer)
        await self.session.commit()

    async def _require_free_answer_position(self, question_id: UUID, display_order: int) -> None:
        taken = await self.answers.exists(
            Answer.question_id == question_id, Answer.display_order == display_order
        )
        if taken:
            raise ConflictError(
                f"Another answer already occupies position {display_order}."
            )
