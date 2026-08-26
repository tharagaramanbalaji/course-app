"""Quiz attempt payloads (sections 16 and 17)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.quiz import QuestionLearnerRead


class AttemptAnswerSubmit(CamelModel):
    question_id: UUID
    answer_id: UUID


class AttemptSubmit(CamelModel):
    """Only the selections. Correctness, points, score and pass/fail are all
    computed server-side and are never accepted from the client."""

    answers: list[AttemptAnswerSubmit] = Field(min_length=1)


class AttemptStartRead(CamelModel):
    """A started attempt, with the questions to answer.

    Carries no correctness information: the answers inside each question use
    the learner schema, which has no isCorrect field.
    """

    id: UUID
    quiz_id: UUID
    attempt_number: int
    started_at: datetime
    max_attempts: int | None
    attempts_remaining: int | None
    passing_score: Decimal
    total_points: Decimal
    questions: list[QuestionLearnerRead]


class CertificateSummary(CamelModel):
    id: UUID
    certificate_number: str
    final_score: Decimal


class AttemptResultRead(CamelModel):
    """The outcome of a submission, including everything the backend derived
    from it: module completion, course completion and any certificate."""

    attempt_id: UUID
    attempt_number: int
    score: Decimal
    passed: bool
    correct_answers: int
    total_questions: int
    points_earned: Decimal
    total_points: Decimal
    attempts_remaining: int | None
    module_completed: bool
    course_completed: bool
    certificate: CertificateSummary | None = None


class AttemptSummary(CamelModel):
    id: UUID
    quiz_id: UUID
    attempt_number: int
    score: Decimal | None
    passed: bool | None
    started_at: datetime
    submitted_at: datetime | None
