"""Domain enumerations.

Each member's value equals its name, so the database stores the readable
label regardless of whether the dialect has native enum support.
"""

from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    INSTRUCTOR = "INSTRUCTOR"
    USER = "USER"

    @property
    def can_author_courses(self) -> bool:
        return self in (UserRole.ADMIN, UserRole.INSTRUCTOR)


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class CourseStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class AssignmentStatus(str, Enum):
    ASSIGNED = "ASSIGNED"
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EnrollmentSource(str, Enum):
    ASSIGNMENT = "ASSIGNMENT"
    SELF_ENROLLED = "SELF_ENROLLED"


class EnrollmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ContentType(str, Enum):
    TEXT = "TEXT"
    VIDEO = "VIDEO"


class ProgressStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
