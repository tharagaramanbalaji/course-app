"""Course, the unit of ownership and publication."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CourseStatus

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.enrollment import Enrollment
    from app.models.module import Module
    from app.models.user import User


class Course(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A course owned by exactly one ADMIN or INSTRUCTOR.

    ``created_by`` is the single source of truth for authorisation: every
    course-scoped admin operation compares it against the authenticated user.
    """

    __tablename__ = "courses"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus, name="course_status"),
        nullable=False,
        default=CourseStatus.DRAFT,
        server_default=CourseStatus.DRAFT.value,
    )
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", name="fk_courses_created_by_users"),
        nullable=False,
    )
    allow_self_enrollment: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship(back_populates="owned_courses", foreign_keys=[created_by])
    modules: Mapped[list[Module]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Module.display_order",
        passive_deletes=True,
    )
    assignments: Mapped[list[Assignment]] = relationship(back_populates="course")
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="course")

    __table_args__ = (
        Index("ix_courses_created_by", "created_by"),
        Index("ix_courses_status", "status"),
        Index("ix_courses_category", "category"),
        Index("ix_courses_created_at", "created_at"),
    )

    @property
    def is_editable(self) -> bool:
        """V1 allows structural edits only while the course is a draft."""
        return self.status == CourseStatus.DRAFT

    def __repr__(self) -> str:
        return f"<Course {self.title!r} ({self.status.value})>"
