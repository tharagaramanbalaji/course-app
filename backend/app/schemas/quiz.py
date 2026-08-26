"""Quiz, question and answer payloads (sections 7 to 9).

Two views exist for every level. The authoring view carries ``isCorrect``;
the learner view has no such field at all, so correctness cannot leak
through a forgotten exclude.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel

# --- answers ---------------------------------------------------------


class AnswerCreate(CamelModel):
    answer_text: str = Field(min_length=1)
    is_correct: bool = False
    display_order: int | None = Field(default=None, ge=1)


class AnswerUpdate(CamelModel):
    answer_text: str | None = Field(default=None, min_length=1)
    is_correct: bool | None = None
    display_order: int | None = Field(default=None, ge=1)


class AnswerRead(CamelModel):
    """Authoring view."""

    id: UUID
    question_id: UUID
    answer_text: str
    is_correct: bool
    display_order: int


class AnswerLearnerRead(CamelModel):
    """Learner view. Deliberately has no isCorrect field."""

    id: UUID
    answer_text: str
    display_order: int


# --- questions -------------------------------------------------------


class QuestionCreate(CamelModel):
    question_text: str = Field(min_length=1)
    points: Decimal = Field(gt=0, max_digits=8, decimal_places=2)
    display_order: int | None = Field(default=None, ge=1)


class QuestionUpdate(CamelModel):
    question_text: str | None = Field(default=None, min_length=1)
    points: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    display_order: int | None = Field(default=None, ge=1)


class QuestionReorder(CamelModel):
    question_ids: list[UUID] = Field(min_length=1)


class QuestionRead(CamelModel):
    id: UUID
    quiz_id: UUID
    question_text: str
    points: Decimal
    display_order: int
    answers: list[AnswerRead] = []


class QuestionLearnerRead(CamelModel):
    id: UUID
    question_text: str
    points: Decimal
    display_order: int
    answers: list[AnswerLearnerRead] = []


# --- quizzes ---------------------------------------------------------


class QuizCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    passing_score: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    max_attempts: int | None = Field(default=None, ge=1)
    randomize_questions: bool = False


class QuizUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    passing_score: Decimal | None = Field(
        default=None, ge=0, le=100, max_digits=5, decimal_places=2
    )
    max_attempts: int | None = Field(default=None, ge=1)
    randomize_questions: bool | None = None


class QuizRead(CamelModel):
    """Authoring view, including correct answers."""

    id: UUID
    module_id: UUID
    title: str
    passing_score: Decimal
    max_attempts: int | None
    randomize_questions: bool
    created_at: datetime
    updated_at: datetime
    questions: list[QuestionRead] = []


class QuizLearnerRead(CamelModel):
    """Learner view of the quiz configuration.

    Questions are fetched separately when an attempt starts, so this carries
    only what a learner needs to decide whether to begin.
    """

    id: UUID
    title: str
    passing_score: Decimal
    max_attempts: int | None
    randomize_questions: bool
    attempts_used: int
    attempts_remaining: int | None
