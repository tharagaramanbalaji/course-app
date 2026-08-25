"""Quiz, its questions and their answers.

Kept in one module because the three tables form a single authoring
aggregate and always change together.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.module import Module
    from app.models.quiz_attempt import QuizAttempt, QuizAttemptAnswer


class Quiz(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The single quiz belonging to a module.

    ``max_attempts`` of NULL means unlimited retries; any other value is the
    ceiling the backend enforces when a learner starts an attempt.
    """

    __tablename__ = "quizzes"

    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("modules.id", ondelete="CASCADE", name="fk_quizzes_module_id_modules"),
        nullable=False,
        unique=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    passing_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    max_attempts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    randomize_questions: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    module: Mapped[Module] = relationship(back_populates="quiz")
    questions: Mapped[list[Question]] = relationship(
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="Question.display_order",
        passive_deletes=True,
    )
    attempts: Mapped[list[QuizAttempt]] = relationship(back_populates="quiz")

    __table_args__ = (
        CheckConstraint(
            "passing_score >= 0 AND passing_score <= 100",
            name="passing_score_percentage",
        ),
        CheckConstraint(
            "max_attempts IS NULL OR max_attempts >= 1",
            name="max_attempts_positive",
        ),
    )

    @property
    def total_points(self) -> Decimal:
        return sum((q.points for q in self.questions), Decimal("0"))

    def __repr__(self) -> str:
        return f"<Quiz {self.title!r} pass>={self.passing_score}>"


class Question(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A multiple-choice question. Scoring is points-based, not per-question."""

    __tablename__ = "questions"

    quiz_id: Mapped[UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE", name="fk_questions_quiz_id_quizzes"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    answers: Mapped[list[Answer]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="Answer.display_order",
        passive_deletes=True,
    )
    attempt_answers: Mapped[list[QuizAttemptAnswer]] = relationship(back_populates="question")

    __table_args__ = (
        UniqueConstraint("quiz_id", "display_order", name="uq_questions_quiz_id_display_order"),
        CheckConstraint("points > 0", name="points_positive"),
        CheckConstraint("display_order > 0", name="display_order_positive"),
        Index("ix_questions_quiz_id", "quiz_id"),
    )

    def __repr__(self) -> str:
        return f"<Question {self.display_order} ({self.points} pts)>"


class Answer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A selectable option.

    ``is_correct`` is authoring data. It must never reach a learner-facing
    response; learner schemas exclude it explicitly.
    """

    __tablename__ = "answers"

    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE", name="fk_answers_question_id_questions"),
        nullable=False,
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    question: Mapped[Question] = relationship(back_populates="answers")

    __table_args__ = (
        UniqueConstraint(
            "question_id", "display_order", name="uq_answers_question_id_display_order"
        ),
        CheckConstraint("display_order > 0", name="display_order_positive"),
        Index("ix_answers_question_id", "question_id"),
    )

    def __repr__(self) -> str:
        return f"<Answer {self.display_order}>"
