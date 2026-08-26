"""Training content payloads (section 6)."""

from datetime import datetime
from uuid import UUID

from pydantic import Field, model_validator

from app.models.enums import ContentType
from app.schemas.base import CamelModel


class ContentCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    content_type: ContentType
    content_body: str | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    display_order: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def payload_matches_type(self) -> "ContentCreate":
        """Mirrors the database check constraint, so the caller gets a clear
        validation error rather than an integrity failure."""
        if self.content_type is ContentType.TEXT and not self.content_body:
            raise ValueError("TEXT content requires contentBody.")
        if self.content_type is ContentType.VIDEO and not self.video_url:
            raise ValueError("VIDEO content requires videoUrl.")
        return self


class ContentUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content_body: str | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    display_order: int | None = Field(default=None, ge=1)


class ContentReorder(CamelModel):
    content_ids: list[UUID] = Field(min_length=1)


class ContentRead(CamelModel):
    id: UUID
    module_id: UUID
    title: str
    content_type: ContentType
    content_body: str | None
    video_url: str | None
    display_order: int
    created_at: datetime
    updated_at: datetime


class ContentLearnerRead(CamelModel):
    """Learner view, carrying this learner's completion state."""

    id: UUID
    title: str
    content_type: ContentType
    content_body: str | None
    video_url: str | None
    display_order: int
    completed: bool
