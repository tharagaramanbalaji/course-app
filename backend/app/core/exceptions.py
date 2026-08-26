"""Application error types and the consistent JSON error envelope.

Every error response has the shape::

    {"error": {"code": "NOT_FOUND", "message": "...", "details": {...}}}
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base class for expected, domain-level failures."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "APP_ERROR"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "RESOURCE_NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class BusinessRuleError(AppError):
    """A request that is well-formed but violates a domain rule."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "BUSINESS_RULE_VIOLATION"


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "SERVICE_UNAVAILABLE"


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHENTICATED"


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body(
                "VALIDATION_ERROR",
                "Request validation failed.",
                {"errors": jsonable_encoder(exc.errors())},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body("HTTP_ERROR", str(exc.detail)),
            headers=getattr(exc, "headers", None),
        )
