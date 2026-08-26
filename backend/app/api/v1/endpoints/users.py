"""User management endpoints (section 3). ADMIN only."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AdminUser, DbSession
from app.models.enums import UserRole, UserStatus
from app.schemas.common import DataResponse, PaginatedResponse, PaginationParams, pagination_params
from app.schemas.user import (
    UserCreate,
    UserRead,
    UserRoleUpdate,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["users"])

Pagination = Annotated[PaginationParams, Depends(pagination_params)]


@router.get("", response_model=PaginatedResponse[UserRead])
async def list_users(
    _: AdminUser,
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=255)] = None,
    role: UserRole | None = None,
    user_status: Annotated[UserStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[UserRead]:
    users, total = await UserService(db).list_users(
        pagination, search=search, role=role, status=user_status
    )
    return PaginatedResponse(
        data=[UserRead.model_validate(u) for u in users],
        pagination=pagination.meta(total),
    )


@router.post("", response_model=DataResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _: AdminUser,
    db: DbSession,
) -> DataResponse[UserRead]:
    """The password is hashed here; the API never accepts a password hash."""
    user = await UserService(db).create_user(payload)
    return DataResponse(data=UserRead.model_validate(user))


@router.get("/{user_id}", response_model=DataResponse[UserRead])
async def get_user(user_id: UUID, _: AdminUser, db: DbSession) -> DataResponse[UserRead]:
    user = await UserService(db).get_user(user_id)
    return DataResponse(data=UserRead.model_validate(user))


@router.patch("/{user_id}", response_model=DataResponse[UserRead])
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    _: AdminUser,
    db: DbSession,
) -> DataResponse[UserRead]:
    """Profile fields only. Role changes go through /role, so an escalation
    cannot be smuggled into an ordinary profile edit."""
    user = await UserService(db).update_user(user_id, payload)
    return DataResponse(data=UserRead.model_validate(user))


@router.patch("/{user_id}/role", response_model=DataResponse[UserRead])
async def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    _: AdminUser,
    db: DbSession,
) -> DataResponse[UserRead]:
    user = await UserService(db).set_role(user_id, payload.role)
    return DataResponse(data=UserRead.model_validate(user))


@router.patch("/{user_id}/status", response_model=DataResponse[UserRead])
async def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    _: AdminUser,
    db: DbSession,
) -> DataResponse[UserRead]:
    user = await UserService(db).set_status(user_id, payload.status)
    return DataResponse(data=UserRead.model_validate(user))
