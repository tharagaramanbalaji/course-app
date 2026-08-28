"""Training content: a text passage or a video, inside a module."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ContentType

if TYPE_CHECKING:
    from app.models.module import Module
    from app.models.progress import ContentProgress


class Content(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One piece of training material.

    The payload column depends on ``content_type``: TEXT items carry
    ``content_body``, VIDEO items carry ``video_url``. A check constraint
    keeps the two in step at the database level.
    """

    __tablename__ = "contents"

    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("modules.id", ondelete="CASCADE", name="fk_contents_module_id_modules"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType, name="content_type"),
        nullable=False,
    )
    content_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    module: Mapped[Module] = relationship(back_populates="contents")
    progress_records: Mapped[list[ContentProgress]] = relationship(back_populates="content")

    __table_args__ = (
        UniqueConstraint("module_id", "display_order", name="uq_contents_module_id_display_order"),
        CheckConstraint("display_order > 0", name="display_order_positive"),
        CheckConstraint(
            "(content_type = 'TEXT' AND content_body IS NOT NULL)"
            " OR (content_type = 'VIDEO' AND video_url IS NOT NULL)",
            name="payload_matches_type",
        ),
        Index("ix_contents_module_id", "module_id"),
    )

    def __repr__(self) -> str:
        return f"<Content {self.content_type.value} {self.title!r}>"
