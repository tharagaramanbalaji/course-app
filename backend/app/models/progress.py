"""Learner progress, tracked at content and module level.

Both tables are derived state: the backend writes them, the client only
reads them. Nothing here may be set directly from a request body.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ProgressStatus

if TYPE_CHECKING:
    from app.models.content import Content
    from app.models.enrollment import Enrollment
    from app.models.module import Module


class ContentProgress(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Whether one content item has been completed within one enrollment.

    The unique constraint makes the completion endpoint idempotent: repeat
    calls update the existing row rather than inserting duplicates.
    """

    __tablename__ = "content_progress"

    enrollment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "enrollments.id",
            ondelete="CASCADE",
            name="fk_content_progress_enrollment_id_enrollments",
        ),
        nullable=False,
    )
    content_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "contents.id",
            ondelete="RESTRICT",
            name="fk_content_progress_content_id_contents",
        ),
        nullable=False,
    )
    completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    enrollment: Mapped[Enrollment] = relationship(back_populates="content_progress")
    content: Mapped[Content] = relationship(back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint(
            "enrollment_id", "content_id", name="uq_content_progress_enrollment_id_content_id"
        ),
        Index("ix_content_progress_enrollment_id", "enrollment_id"),
        Index("ix_content_progress_content_id", "content_id"),
    )

    def __repr__(self) -> str:
        return f"<ContentProgress content={self.content_id} completed={self.completed}>"


class ModuleProgress(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Derived completion state for one module within one enrollment.

    ``status`` becomes COMPLETED only when ``content_completed`` and
    ``quiz_passed`` are both true. The client never sets it.
    """

    __tablename__ = "module_progress"

    enrollment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "enrollments.id",
            ondelete="CASCADE",
            name="fk_module_progress_enrollment_id_enrollments",
        ),
        nullable=False,
    )
    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("modules.id", ondelete="RESTRICT", name="fk_module_progress_module_id_modules"),
        nullable=False,
    )
    content_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    quiz_passed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    status: Mapped[ProgressStatus] = mapped_column(
        Enum(ProgressStatus, name="progress_status"),
        nullable=False,
        default=ProgressStatus.NOT_STARTED,
        server_default=ProgressStatus.NOT_STARTED.value,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    enrollment: Mapped[Enrollment] = relationship(back_populates="module_progress")
    module: Mapped[Module] = relationship(back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint(
            "enrollment_id", "module_id", name="uq_module_progress_enrollment_id_module_id"
        ),
        Index("ix_module_progress_enrollment_id", "enrollment_id"),
        Index("ix_module_progress_module_id", "module_id"),
        Index("ix_module_progress_status", "status"),
    )

    @property
    def is_complete(self) -> bool:
        """Module completion is derived, never asserted by the client."""
        return self.content_completed and self.quiz_passed

    def __repr__(self) -> str:
        return f"<ModuleProgress module={self.module_id} {self.status.value}>"
