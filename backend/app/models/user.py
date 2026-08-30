"""User account."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AuthProvider, UserRole, UserStatus

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.course import Course
    from app.models.enrollment import Enrollment


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A person using the platform, in one of three roles.

    Emails are stored normalised to lowercase, so the unique constraint
    gives case-insensitive uniqueness without a functional index.
    """

    __tablename__ = "users"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.USER,
        server_default=UserRole.USER.value,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.ACTIVE,
        server_default=UserStatus.ACTIVE.value,
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider"),
        nullable=False,
        default=AuthProvider.LOCAL,
        server_default=AuthProvider.LOCAL.value,
    )
    # Bumped on logout, which invalidates every refresh token already issued.
    token_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
    )

    owned_courses: Mapped[list[Course]] = relationship(
        back_populates="owner",
        foreign_keys="Course.created_by",
    )
    assignments: Mapped[list[Assignment]] = relationship(
        back_populates="user",
        foreign_keys="Assignment.user_id",
    )
    created_assignments: Mapped[list[Assignment]] = relationship(
        back_populates="assigned_by_user",
        foreign_keys="Assignment.assigned_by",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="user")

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_status", "status"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"
