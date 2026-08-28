"""Authentication rules (section 2)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, BusinessRuleError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserStatus
from app.models.user import User
from app.repositories.user import UserRepository, normalize_email
from app.schemas.user import UserSelfUpdate

# One message for every failure mode. A caller must not be able to learn
# whether an address is registered by comparing error responses.
INVALID_CREDENTIALS = "Incorrect email or password."


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)

    async def login(self, email: str, password: str) -> tuple[User, str, str]:
        user = await self.users.get_by_email(email)

        if user is None or not verify_password(password, user.password_hash):
            raise AuthenticationError(INVALID_CREDENTIALS)
        if user.status is not UserStatus.ACTIVE:
            # Deliberately the same message: an attacker learns nothing about
            # which accounts exist but are disabled.
            raise AuthenticationError(INVALID_CREDENTIALS)

        return (
            user,
            create_access_token(user.id, user.role.value),
            create_refresh_token(user.id, user.token_version),
        )

    async def refresh(self, refresh_token: str) -> str:
        claims = decode_token(refresh_token, "refresh")
        user = await self._active_user(UUID(claims["sub"]))

        if claims.get("ver") != user.token_version:
            # Issued before a logout, so it is no longer valid.
            raise AuthenticationError("Invalid or expired token.")

        return create_access_token(user.id, user.role.value)

    async def logout(self, user: User) -> None:
        """Invalidate every refresh token issued to this user so far."""
        user.token_version += 1
        await self.session.commit()

    async def resolve_access_token(self, token: str) -> User:
        """The identity behind an access token, for the request dependency."""
        claims = decode_token(token, "access")
        return await self._active_user(UUID(claims["sub"]))

    async def _active_user(self, user_id: UUID) -> User:
        user = await self.users.get(user_id)
        if user is None or user.status is not UserStatus.ACTIVE:
            raise AuthenticationError("Invalid or expired token.")
        return user

    async def update_me(self, user: User, payload: UserSelfUpdate) -> User:
        changes = payload.model_dump(exclude_unset=True)

        if "email" in changes and changes["email"] is not None:
            email = normalize_email(changes["email"])
            if email != user.email and await self.users.email_exists(email):
                raise ConflictError("A user with that email already exists.")
            changes["email"] = email

        for field, value in changes.items():
            if value is not None:
                setattr(user, field, value)

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete_me(self, user: User) -> None:
        if await self.users.has_dependencies(user.id):
            raise BusinessRuleError(
                "Your account has associated data (courses, assignments, or enrollments) "
                "and cannot be deleted. Remove that data first."
            )
        await self.users.delete(user)
        await self.session.commit()
