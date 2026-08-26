"""Shared FastAPI dependencies: the database session and the caller's identity.

Role checks live here rather than inside services, so an endpoint's access
rules are visible in its signature.
"""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.auth import AuthService

DbSession = Annotated[AsyncSession, Depends(get_db)]

# auto_error=False so a missing header raises our envelope, not FastAPI's.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Authentication required.")
    return await AuthService(db).resolve_access_token(credentials.credentials)


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], Coroutine[Any, Any, User]]:
    """Dependency factory restricting an endpoint to the given roles."""

    async def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("You do not have access to this resource.")
        return user

    return dependency


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
AuthorUser = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.INSTRUCTOR))]

__all__ = [
    "AdminUser",
    "AuthorUser",
    "CurrentUser",
    "DbSession",
    "get_current_user",
    "get_db",
    "require_roles",
]
