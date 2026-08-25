"""Assignment: an owner handing a course to a specific learner."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AssignmentStatus

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Assignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A course assigned to a user by its owner.

    Distinct from Enrollment: this records the administrative act, while the
    enrollment records the learner's participation. Assigning does not
    transfer course ownership, which stays with ``courses.created_by``.
    """

    __tablename__ = "assignments"

    course_id: Mapped[UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="RESTRICT", name="fk_assignments_course_id_courses"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", name="fk_assignments_user_id_users"),
        nullable=False,
    )
    assigned_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", name="fk_assignments_assigned_by_users"),
        nullable=False,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus, name="assignment_status"),
        nullable=False,
        default=AssignmentStatus.ASSIGNED,
        server_default=AssignmentStatus.ASSIGNED.value,
    )

    course: Mapped[Course] = relationship(back_populates="assignments")
    user: Mapped[User] = relationship(back_populates="assignments", foreign_keys=[user_id])
    assigned_by_user: Mapped[User] = relationship(
        back_populates="created_assignments",
        foreign_keys=[assigned_by],
    )

    __table_args__ = (
        Index("ix_assignments_course_id", "course_id"),
        Index("ix_assignments_user_id", "user_id"),
        Index("ix_assignments_assigned_by", "assigned_by"),
        Index("ix_assignments_status", "status"),
        Index("ix_assignments_course_id_user_id", "course_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Assignment course={self.course_id} user={self.user_id}>"
