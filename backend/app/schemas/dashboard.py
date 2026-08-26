"""Dashboard payloads (sections 21 to 25)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.models.enums import CourseStatus, EnrollmentStatus, ProgressStatus
from app.schemas.base import CamelModel
from app.schemas.enrollment import MyCourseRead


class RecentAttempt(CamelModel):
    attempt_id: UUID
    course_title: str
    module_title: str
    attempt_number: int
    score: Decimal | None
    passed: bool | None
    submitted_at: datetime | None


class UserDashboard(CamelModel):
    """Only the authenticated learner's own data."""

    assigned_courses: int
    self_enrolled_courses: int
    active_courses: int
    completed_courses: int
    certificates: int
    recent_quiz_attempts: list[RecentAttempt]
    courses: list[MyCourseRead]


class AdminOverview(CamelModel):
    """Aggregates restricted to courses the caller owns."""

    total_courses: int
    published_courses: int
    draft_courses: int
    total_assigned_users: int
    active_enrollments: int
    completed_enrollments: int
    certificates_issued: int
    average_quiz_score: Decimal
    completion_rate: Decimal


class CourseStat(CamelModel):
    course_id: UUID
    title: str
    status: CourseStatus
    modules: int
    assignments: int
    enrollments: int
    completed: int
    completion_rate: Decimal


class LearnerStat(CamelModel):
    user_id: UUID
    first_name: str
    last_name: str
    email: str
    enrolled_courses: int
    completed_courses: int
    certificates: int


class ModuleProgressRow(CamelModel):
    module_id: UUID
    module_title: str
    display_order: int
    status: ProgressStatus
    content_completed: bool
    quiz_passed: bool
    completed_at: datetime | None


class LearnerProgressRow(CamelModel):
    user_id: UUID
    participant_name: str
    email: str
    course_id: UUID
    course_title: str
    enrollment_status: EnrollmentStatus
    completed_modules: int
    total_modules: int
    percent_complete: int


class CourseProgressReport(CamelModel):
    """Aggregate plus per-learner rows for one owned course."""

    course_id: UUID
    title: str
    total_modules: int
    total_learners: int
    completed_learners: int
    completion_rate: Decimal
    learners: list[LearnerProgressRow]


class LearnerProgressDetail(CamelModel):
    user_id: UUID
    participant_name: str
    course_id: UUID
    course_title: str
    enrollment_status: EnrollmentStatus
    percent_complete: int
    modules: list[ModuleProgressRow]


class QuizResultRow(CamelModel):
    attempt_id: UUID
    course_id: UUID
    course_title: str
    module_title: str
    quiz_title: str
    user_id: UUID
    participant_name: str
    attempt_number: int
    score: Decimal | None
    passed: bool | None
    submitted_at: datetime | None


class CompletionRow(CamelModel):
    course_id: UUID
    course_title: str
    user_id: UUID
    participant_name: str
    completed_at: datetime | None
    certificate_number: str | None
    final_score: Decimal | None
