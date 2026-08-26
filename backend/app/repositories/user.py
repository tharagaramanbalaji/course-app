"""User data access."""

from collections.abc import Sequence

from sqlalchemy import func, or_, select

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

    async def search_page(
        self,
        *,
        limit: int,
        offset: int,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
    ) -> tuple[Sequence[User], int]:
        """One page of users plus the unpaginated total, for the envelope."""
        filters = []
        if search:
            pattern = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(User.first_name).like(pattern),
                    func.lower(User.last_name).like(pattern),
                    func.lower(User.email).like(pattern),
                )
            )
        if role is not None:
            filters.append(User.role == role)
        if status is not None:
            filters.append(User.status == status)

        total = await self.session.scalar(
            select(func.count()).select_from(User).where(*filters)
        )
        rows = await self.session.scalars(
            select(User)
            .where(*filters)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return rows.all(), total or 0
