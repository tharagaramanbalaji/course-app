"""SQLAlchemy models.

Every model module is imported here so that ``Base.metadata`` is fully
populated before Alembic autogenerate or ``create_all`` runs.
"""

from app.db.base import Base
from app.models.assignment import Assignment
from app.models.certificate import Certificate
from app.models.content import Content
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.enums import (
    AssignmentStatus,
    ContentType,
    CourseStatus,
    EnrollmentSource,
    EnrollmentStatus,
    ProgressStatus,
    UserRole,
    UserStatus,
)
from app.models.module import Module
from app.models.progress import ContentProgress, ModuleProgress
from app.models.quiz import Answer, Question, Quiz
from app.models.quiz_attempt import QuizAttempt, QuizAttemptAnswer
from app.models.user import User

__all__ = [
    "Answer",
    "Assignment",
    "AssignmentStatus",
    "Base",
    "Certificate",
    "Content",
    "ContentProgress",
    "ContentType",
    "Course",
    "CourseStatus",
    "Enrollment",
    "EnrollmentSource",
    "EnrollmentStatus",
    "Module",
    "ModuleProgress",
    "ProgressStatus",
    "Question",
    "Quiz",
    "QuizAttempt",
    "QuizAttemptAnswer",
    "User",
    "UserRole",
    "UserStatus",
]
