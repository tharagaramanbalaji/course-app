"""Module, an ordered section of a course."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.content import Content
    from app.models.course import Course
    from app.models.progress import ModuleProgress
    from app.models.quiz import Quiz


class Module(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One course section. Ordering is scoped to the parent course.

    Modules are consumed sequentially in V1; the backend derives which are
    unlocked from ``display_order`` and the learner's module progress.
    """

    __tablename__ = "modules"

    course_id: Mapped[UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE", name="fk_modules_course_id_courses"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    course: Mapped[Course] = relationship(back_populates="modules")
    contents: Mapped[list[Content]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Content.display_order",
        passive_deletes=True,
    )
    quiz: Mapped[Quiz | None] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    progress_records: Mapped[list[ModuleProgress]] = relationship(back_populates="module")

    __table_args__ = (
        UniqueConstraint("course_id", "display_order", name="uq_modules_course_id_display_order"),
        CheckConstraint("display_order > 0", name="display_order_positive"),
        Index("ix_modules_course_id", "course_id"),
    )

    def __repr__(self) -> str:
        return f"<Module {self.display_order}. {self.title!r}>"
