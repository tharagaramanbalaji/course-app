"""User data access."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.repositories.base import BaseRepository


def normalize_email(email: str) -> str:
    """Emails are compared case-insensitively, so they are stored lowercased."""
    return email.strip().lower()


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == normalize_email(email))
        return await self.session.scalar(stmt)

    async def email_exists(self, email: str) -> bool:
        return await self.exists(User.email == normalize_email(email))

    async def list_by_role(
        self,
        role: UserRole,
        *,
        status: UserStatus | None = None,
    ) -> Sequence[User]:
        stmt = select(User).where(User.role == role)
        if status is not None:
            stmt = stmt.where(User.status == status)
        return (await self.session.scalars(stmt.order_by(User.created_at))).all()
