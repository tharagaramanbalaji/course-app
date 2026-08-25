"""Quiz attempts and the answers submitted in them.

These rows are the historical record of a learner's result. They preserve
what was true at submission time and are never recomputed afterwards.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment
    from app.models.quiz import Answer, Question, Quiz


class QuizAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One sitting of a quiz.

    ``attempt_number`` is assigned by the backend and unique per enrollment
    and quiz, so a client-supplied number cannot bypass ``max_attempts``.
    ``score`` and ``passed`` stay NULL until the attempt is submitted.
    """

    __tablename__ = "quiz_attempts"

    quiz_id: Mapped[UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="RESTRICT", name="fk_quiz_attempts_quiz_id_quizzes"),
        nullable=False,
    )
    enrollment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "enrollments.id",
            ondelete="CASCADE",
            name="fk_quiz_attempts_enrollment_id_enrollments",
        ),
        nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    enrollment: Mapped[Enrollment] = relationship(back_populates="quiz_attempts")
    answers: Mapped[list[QuizAttemptAnswer]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "enrollment_id",
            "quiz_id",
            "attempt_number",
            name="uq_quiz_attempts_enrollment_id_quiz_id_attempt_number",
        ),
        CheckConstraint("attempt_number >= 1", name="attempt_number_positive"),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="score_percentage",
        ),
        Index("ix_quiz_attempts_quiz_id", "quiz_id"),
        Index("ix_quiz_attempts_enrollment_id", "enrollment_id"),
        Index("ix_quiz_attempts_enrollment_id_quiz_id", "enrollment_id", "quiz_id"),
    )

    @property
    def is_submitted(self) -> bool:
        return self.submitted_at is not None

    def __repr__(self) -> str:
        return f"<QuizAttempt #{self.attempt_number} score={self.score}>"


class QuizAttemptAnswer(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """One question's selected answer within an attempt.

    ``is_correct`` and ``points_earned`` are computed by the backend from the
    database and stored as a snapshot; they are never read from the request.
    """

    __tablename__ = "quiz_attempt_answers"

    attempt_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "quiz_attempts.id",
            ondelete="CASCADE",
            name="fk_quiz_attempt_answers_attempt_id_quiz_attempts",
        ),
        nullable=False,
    )
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "questions.id",
            ondelete="RESTRICT",
            name="fk_quiz_attempt_answers_question_id_questions",
        ),
        nullable=False,
    )
    answer_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "answers.id",
            ondelete="RESTRICT",
            name="fk_quiz_attempt_answers_answer_id_answers",
        ),
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    points_earned: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="attempt_answers")
    answer: Mapped[Answer] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "attempt_id", "question_id", name="uq_quiz_attempt_answers_attempt_id_question_id"
        ),
        CheckConstraint("points_earned >= 0", name="points_earned_non_negative"),
        Index("ix_quiz_attempt_answers_attempt_id", "attempt_id"),
        Index("ix_quiz_attempt_answers_question_id", "question_id"),
        Index("ix_quiz_attempt_answers_answer_id", "answer_id"),
    )

    def __repr__(self) -> str:
        return f"<QuizAttemptAnswer question={self.question_id} correct={self.is_correct}>"
