"""Authentication endpoints (section 2)."""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import AccessTokenResponse, LoginRequest, LoginResponse, RefreshRequest
from app.schemas.common import DataResponse
from app.schemas.user import UserRead, UserSelfUpdate
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=DataResponse[LoginResponse])
async def login(payload: LoginRequest, db: DbSession) -> DataResponse[LoginResponse]:
    """Exchange credentials for an access and a refresh token."""
    user, access_token, refresh_token = await AuthService(db).login(
        payload.email, payload.password
    )
    return DataResponse(
        data=LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserRead.model_validate(user),
        )
    )


@router.post("/refresh", response_model=DataResponse[AccessTokenResponse])
async def refresh(payload: RefreshRequest, db: DbSession) -> DataResponse[AccessTokenResponse]:
    """Exchange a refresh token for a new access token."""
    access_token = await AuthService(db).refresh(payload.refresh_token)
    return DataResponse(data=AccessTokenResponse(access_token=access_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: CurrentUser, db: DbSession) -> None:
    """Revoke every refresh token issued to the caller so far."""
    await AuthService(db).logout(user)


@router.get("/me", response_model=DataResponse[UserRead])
async def me(user: CurrentUser) -> DataResponse[UserRead]:
    return DataResponse(data=UserRead.model_validate(user))


@router.patch("/me", response_model=DataResponse[UserRead])
async def update_me(
    payload: UserSelfUpdate,
    user: CurrentUser,
    db: DbSession,
) -> DataResponse[UserRead]:
    """Edit the caller's own profile: first name, last name, or email."""
    updated = await AuthService(db).update_me(user, payload)
    return DataResponse(data=UserRead.model_validate(updated))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: CurrentUser, db: DbSession) -> None:
    """Delete the caller's own account. Fails if the user owns courses."""
    await AuthService(db).delete_me(user)
