"""Application settings, loaded from environment / .env."""

import json
from functools import lru_cache
from typing import Any, Literal, Union

from pydantic import PostgresDsn, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_async_db_url(url: str) -> str:
    """Ensure PostgreSQL connection strings use the asyncpg driver."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "Course Training Platform"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["local", "test", "staging", "production"] = "local"
    DEBUG: bool = True

    # --- Database ---
    DATABASE_URL: str | None = None
    DATABASE_URL_OVERRIDE: str | None = None

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "courseapp"
    POSTGRES_PASSWORD: str = "courseapp"
    POSTGRES_DB: str = "courseapp"

    # --- Auth ---
    SECRET_KEY: str = "change-me-in-every-real-environment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Enterprise SSO (Google Workspace, OIDC) ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    SSO_ALLOWED_DOMAINS: Union[list[str], str] = []
    SSO_AUTO_PROVISION: bool = True
    SSO_DEFAULT_ROLE: str = "USER"
    FRONTEND_URL: str = "http://localhost:5173"

    # --- PDFMonkey ---
    PDFMONKEY_API_KEY: str = ""
    PDFMONKEY_TEMPLATE_ID: str = ""
    PDFMONKEY_BASE_URL: str = "https://api.pdfmonkey.io/api/v1"

    # --- CORS ---
    BACKEND_CORS_ORIGINS: Union[list[str], str] = ["http://localhost:5173"]
    BACKEND_CORS_ORIGIN_REGEX: str | None = r"^https:\/\/.*\.vercel\.app$"

    @field_validator("BACKEND_CORS_ORIGINS", "SSO_ALLOWED_DOMAINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            val = value.strip()
            if not val:
                return []
            if val.startswith("[") and val.endswith("]"):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [item.strip() for item in val.split(",") if item.strip()]
        if isinstance(value, (list, tuple, set)):
            return [str(item).strip() for item in value if str(item).strip()]
        return []

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """Async driver URL used by the app and by Alembic."""
        if self.DATABASE_URL_OVERRIDE:
            return _normalize_async_db_url(self.DATABASE_URL_OVERRIDE)
        if self.DATABASE_URL:
            return _normalize_async_db_url(self.DATABASE_URL)
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
