"""Password hashing and JWT issuing/verification.

Access tokens are short-lived and carry the role, so authorisation does not
need a database round trip on every request. Refresh tokens carry the user's
``token_version``; logout increments that version, which invalidates every
refresh token previously issued to them.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import AuthenticationError

TokenType = Literal["access", "refresh"]

# bcrypt silently truncates anything longer, so it is rejected instead.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        # A malformed stored hash must read as "wrong password", not crash.
        return False


def _encode(payload: dict[str, Any], expires_delta: timedelta, token_type: TokenType) -> str:
    now = datetime.now(UTC)
    claims = {
        **payload,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    return _encode(
        {"sub": str(user_id), "role": role},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(user_id: uuid.UUID, token_version: int) -> str:
    return _encode(
        {"sub": str(user_id), "ver": token_version},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Decode and validate a token, or raise ``AuthenticationError``.

    Every failure produces the same generic message: a caller must not be able
    to tell an expired token from a forged one.
    """
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired token.") from exc

    if claims.get("type") != expected_type:
        raise AuthenticationError("Invalid or expired token.")
    if not claims.get("sub"):
        raise AuthenticationError("Invalid or expired token.")
    return claims
