"""Assignment payloads (section 10)."""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr

from app.models.enums import AssignmentStatus
from app.schemas.base import CamelModel


class AssignmentCreate(CamelModel):
    """``assignedBy``, ``assignedAt`` and ``status`` are set by the server."""

    user_id: UUID
    due_date: datetime | None = None


class AssignmentUpdate(CamelModel):
    due_date: datetime | None = None
    status: AssignmentStatus | None = None


class AssignmentRead(CamelModel):
    id: UUID
    course_id: UUID
    user_id: UUID
    assigned_by: UUID
    assigned_at: datetime
    due_date: datetime | None
    status: AssignmentStatus
    created_at: datetime


class AssignableUserRead(CamelModel):
    """A learner an owner may assign this course to.

    Deliberately minimal. Listing users is otherwise ADMIN-only, so this
    course-scoped view exposes only what a picker needs and nothing about
    roles, status or account history.
    """

    id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    already_assigned: bool
