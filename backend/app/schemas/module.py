"""Module payloads (section 5)."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import ProgressStatus
from app.schemas.base import CamelModel


class ModuleCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    display_order: int | None = Field(default=None, ge=1)


class ModuleUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    display_order: int | None = Field(default=None, ge=1)


class ModuleReorder(CamelModel):
    module_ids: list[UUID] = Field(min_length=1)


class ModuleRead(CamelModel):
    """Authoring view, for the course owner."""

    id: UUID
    course_id: UUID
    title: str
    description: str | None
    display_order: int
    created_at: datetime
    updated_at: datetime


class ModuleLearnerRead(CamelModel):
    """Learner view.

    ``unlocked`` is decided by the backend from the learner's progress:
    modules are sequential in V1, so a module opens only once every earlier
    one is complete.
    """

    id: UUID
    title: str
    description: str | None
    display_order: int
    status: ProgressStatus
    content_completed: bool
    quiz_passed: bool
    unlocked: bool
    has_quiz: bool
    content_count: int
