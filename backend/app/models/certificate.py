"""Certificate, issued once per completed enrollment."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment


class Certificate(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """An immutable record of course completion.

    Participant and course names are copied in rather than joined, so a later
    rename of the user or course cannot rewrite history. There is no
    ``updated_at``: the row is written once and never changed.
    """

    __tablename__ = "certificates"

    certificate_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    enrollment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "enrollments.id",
            ondelete="RESTRICT",
            name="fk_certificates_enrollment_id_enrollments",
        ),
        nullable=False,
        unique=True,
    )
    participant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_name: Mapped[str] = mapped_column(String(255), nullable=False)
    completion_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    final_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    certificate_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    enrollment: Mapped[Enrollment] = relationship(back_populates="certificate")

    __table_args__ = (
        CheckConstraint(
            "final_score >= 0 AND final_score <= 100",
            name="final_score_percentage",
        ),
        # certificate_number and enrollment_id are already indexed by their
        # UNIQUE constraints; a second index would be redundant.
    )

    def __repr__(self) -> str:
        return f"<Certificate {self.certificate_number} score={self.final_score}>"
