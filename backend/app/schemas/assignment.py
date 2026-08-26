"""Assignment payloads (section 10)."""

from datetime import datetime
from uuid import UUID

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
