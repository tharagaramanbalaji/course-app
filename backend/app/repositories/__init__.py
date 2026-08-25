"""Data-access layer.

One repository per aggregate. They hold queries, including the ownership and
user filtering that must happen in SQL rather than in the client.
"""

from app.repositories.base import BaseRepository
from app.repositories.certificate import CertificateRepository
from app.repositories.course import ContentRepository, CourseRepository, ModuleRepository
from app.repositories.enrollment import AssignmentRepository, EnrollmentRepository
from app.repositories.progress import ContentProgressRepository, ModuleProgressRepository
from app.repositories.quiz import AnswerRepository, QuestionRepository, QuizRepository
from app.repositories.quiz_attempt import QuizAttemptAnswerRepository, QuizAttemptRepository
from app.repositories.user import UserRepository, normalize_email

__all__ = [
    "AnswerRepository",
    "AssignmentRepository",
    "BaseRepository",
    "CertificateRepository",
    "ContentProgressRepository",
    "ContentRepository",
    "CourseRepository",
    "EnrollmentRepository",
    "ModuleProgressRepository",
    "ModuleRepository",
    "QuestionRepository",
    "QuizAttemptAnswerRepository",
    "QuizAttemptRepository",
    "QuizRepository",
    "UserRepository",
    "normalize_email",
]
