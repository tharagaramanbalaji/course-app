"""Training content payloads (section 6)."""

from datetime import datetime
from uuid import UUID

from pydantic import Field, computed_field, field_validator, model_validator

from app.core.video import UnsupportedVideoUrl, describe, normalize_video_url
from app.models.enums import ContentType
from app.schemas.base import CamelModel


def _normalise(url: str | None) -> str | None:
    """Store the canonical form of a pasted link, or reject it clearly."""
    if url is None or not url.strip():
        return None
    try:
        return normalize_video_url(url)
    except UnsupportedVideoUrl as exc:
        raise ValueError(str(exc)) from exc


class VideoSourceRead(CamelModel):
    """How to play a video, derived from the stored URL.

    Kept out of the database: it is a function of the provider and the id,
    so deriving it means a provider change needs no migration.
    """

    provider: str
    video_id: str | None
    url: str
    embed_url: str
    thumbnail_url: str | None


class ContentCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    content_type: ContentType
    content_body: str | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    display_order: int | None = Field(default=None, ge=1)

    @field_validator("video_url")
    @classmethod
    def canonical_video_url(cls, value: str | None) -> str | None:
        return _normalise(value)

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

    @field_validator("video_url")
    @classmethod
    def canonical_video_url(cls, value: str | None) -> str | None:
        return _normalise(value)


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

    @computed_field
    @property
    def video(self) -> VideoSourceRead | None:
        source = describe(self.video_url)
        return VideoSourceRead.model_validate(source) if source else None


class ContentLearnerRead(CamelModel):
    """Learner view, carrying this learner's completion state."""

    id: UUID
    title: str
    content_type: ContentType
    content_body: str | None
    video_url: str | None
    display_order: int
    completed: bool

    @computed_field
    @property
    def video(self) -> VideoSourceRead | None:
        source = describe(self.video_url)
        return VideoSourceRead.model_validate(source) if source else None
