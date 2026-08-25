"""Quiz authoring data access."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.quiz import Answer, Question, Quiz
from app.repositories.base import BaseRepository


class QuizRepository(BaseRepository[Quiz]):
    model = Quiz

    async def get_by_module(self, module_id: UUID) -> Quiz | None:
        return await self.session.scalar(select(Quiz).where(Quiz.module_id == module_id))

    async def get_with_questions(self, quiz_id: UUID) -> Quiz | None:
        """Load the quiz, its questions and their answers.

        Used for scoring, where correctness must come from the database. The
        learner-facing schema drops ``is_correct`` before serialisation.
        """
        stmt = (
            select(Quiz)
            .where(Quiz.id == quiz_id)
            .options(selectinload(Quiz.questions).selectinload(Question.answers))
        )
        return await self.session.scalar(stmt)


class QuestionRepository(BaseRepository[Question]):
    model = Question

    async def list_by_quiz(self, quiz_id: UUID) -> Sequence[Question]:
        stmt = (
            select(Question)
            .where(Question.quiz_id == quiz_id)
            .order_by(Question.display_order)
            .options(selectinload(Question.answers))
        )
        return (await self.session.scalars(stmt)).all()

    async def get_in_quiz(self, question_id: UUID, quiz_id: UUID) -> Question | None:
        stmt = select(Question).where(Question.id == question_id, Question.quiz_id == quiz_id)
        return await self.session.scalar(stmt)

    async def next_display_order(self, quiz_id: UUID) -> int:
        stmt = select(Question.display_order).where(Question.quiz_id == quiz_id)
        return max((await self.session.scalars(stmt)).all(), default=0) + 1


class AnswerRepository(BaseRepository[Answer]):
    model = Answer

    async def list_by_question(self, question_id: UUID) -> Sequence[Answer]:
        stmt = (
            select(Answer)
            .where(Answer.question_id == question_id)
            .order_by(Answer.display_order)
        )
        return (await self.session.scalars(stmt)).all()

    async def get_in_question(self, answer_id: UUID, question_id: UUID) -> Answer | None:
        """Rejects an answer id that belongs to a different question."""
        stmt = select(Answer).where(Answer.id == answer_id, Answer.question_id == question_id)
        return await self.session.scalar(stmt)

    async def count_correct(self, question_id: UUID) -> int:
        return await self.count(Answer.question_id == question_id, Answer.is_correct.is_(True))

    async def next_display_order(self, question_id: UUID) -> int:
        stmt = select(Answer.display_order).where(Answer.question_id == question_id)
        return max((await self.session.scalars(stmt)).all(), default=0) + 1
