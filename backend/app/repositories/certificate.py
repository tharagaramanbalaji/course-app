"""Certificate data access."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from app.models.certificate import Certificate
from app.models.enrollment import Enrollment
from app.repositories.base import BaseRepository


class CertificateRepository(BaseRepository[Certificate]):
    model = Certificate

    async def get_by_enrollment(self, enrollment_id: UUID) -> Certificate | None:
        """The existence check that makes certificate generation idempotent."""
        stmt = select(Certificate).where(Certificate.enrollment_id == enrollment_id)
        return await self.session.scalar(stmt)

    async def get_by_number(self, certificate_number: str) -> Certificate | None:
        """Backs public verification by certificate number."""
        stmt = select(Certificate).where(Certificate.certificate_number == certificate_number)
        return await self.session.scalar(stmt)

    async def number_exists(self, certificate_number: str) -> bool:
        return await self.exists(Certificate.certificate_number == certificate_number)

    async def list_for_user(self, user_id: UUID) -> Sequence[Certificate]:
        stmt = (
            select(Certificate)
            .join(Enrollment, Enrollment.id == Certificate.enrollment_id)
            .where(Enrollment.user_id == user_id)
            .order_by(Certificate.completion_date.desc())
        )
        return (await self.session.scalars(stmt)).all()
