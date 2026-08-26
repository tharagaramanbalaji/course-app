"""Enrollment and learner course payloads (section 11)."""

from datetime import datetime
from uuid import UUID

from app.models.enums import (
    AssignmentStatus,
    CourseStatus,
    EnrollmentSource,
    EnrollmentStatus,
)
from app.schemas.base import CamelModel


class EnrollmentRead(CamelModel):
    id: UUID
    course_id: UUID
    user_id: UUID
    source: EnrollmentSource
    status: EnrollmentStatus
    started_at: datetime
    completed_at: datetime | None


class ProgressSummary(CamelModel):
    """Derived by the backend; the client never computes these."""

    total_modules: int
    completed_modules: int
    percent_complete: int


class AssignmentSummary(CamelModel):
    """Present only when the enrollment came from an assignment."""

    id: UUID
    assigned_at: datetime
    due_date: datetime | None
    status: AssignmentStatus


class MyCourseRead(CamelModel):
    """One row of /my/courses: the course, the learner's enrollment in it,
    their progress, and the assignment behind it where there was one."""

    course_id: UUID
    title: str
    description: str
    category: str | None
    thumbnail_url: str | None
    course_status: CourseStatus
    enrollment: EnrollmentRead
    progress: ProgressSummary
    assignment: AssignmentSummary | None = None
