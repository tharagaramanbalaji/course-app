"""Enrollment: a learner's participation in a course."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import EnrollmentSource, EnrollmentStatus

if TYPE_CHECKING:
    from app.models.certificate import Certificate
    from app.models.course import Course
    from app.models.progress import ContentProgress, ModuleProgress
    from app.models.quiz_attempt import QuizAttempt
    from app.models.user import User


class Enrollment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The parent record for everything a learner does in a course.

    Progress, quiz attempts and the certificate all hang off this row, so a
    learner's history for a course is reachable from a single identifier.
    """

    __tablename__ = "enrollments"

    course_id: Mapped[UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="RESTRICT", name="fk_enrollments_course_id_courses"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", name="fk_enrollments_user_id_users"),
        nullable=False,
    )
    source: Mapped[EnrollmentSource] = mapped_column(
        Enum(EnrollmentSource, name="enrollment_source"),
        nullable=False,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, name="enrollment_status"),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
        server_default=EnrollmentStatus.ACTIVE.value,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped[Course] = relationship(back_populates="enrollments")
    user: Mapped[User] = relationship(back_populates="enrollments")
    content_progress: Mapped[list[ContentProgress]] = relationship(
        back_populates="enrollment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    module_progress: Mapped[list[ModuleProgress]] = relationship(
        back_populates="enrollment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    quiz_attempts: Mapped[list[QuizAttempt]] = relationship(
        back_populates="enrollment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    certificate: Mapped[Certificate | None] = relationship(
        back_populates="enrollment",
        uselist=False,
    )

    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_enrollments_course_id_user_id"),
        Index("ix_enrollments_course_id", "course_id"),
        Index("ix_enrollments_user_id", "user_id"),
        Index("ix_enrollments_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Enrollment course={self.course_id} user={self.user_id} {self.status.value}>"
