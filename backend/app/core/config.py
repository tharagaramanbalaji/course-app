"""Application settings, loaded from environment / .env."""

from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "courseapp"
    POSTGRES_PASSWORD: str = "courseapp"
    POSTGRES_DB: str = "courseapp"

    # Set directly (e.g. in tests) to bypass the assembled Postgres URL.
    DATABASE_URL_OVERRIDE: str | None = None

    # --- Auth ---
    SECRET_KEY: str = "change-me-in-every-real-environment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Enterprise SSO (Google Workspace, OIDC) ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    SSO_ALLOWED_DOMAINS: list[str] = []
    SSO_AUTO_PROVISION: bool = True
    SSO_DEFAULT_ROLE: str = "USER"
    FRONTEND_URL: str = "http://localhost:5173"

    # --- CORS ---
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """Async driver URL used by the app and by Alembic."""
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
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
