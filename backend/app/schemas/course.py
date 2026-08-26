"""Course payloads (section 4).

``status``, ``createdBy`` and ``publishedAt`` are read-only: the server sets
them, so no create or update schema accepts them.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import CourseStatus
from app.schemas.base import CamelModel


class CourseRead(CamelModel):
    id: UUID
    title: str
    description: str
    category: str | None
    thumbnail_url: str | None
    status: CourseStatus
    created_by: UUID
    allow_self_enrollment: bool
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class CourseCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    category: str | None = Field(default=None, max_length=100)
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    allow_self_enrollment: bool = False


class CourseUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    category: str | None = Field(default=None, max_length=100)
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    allow_self_enrollment: bool | None = None
