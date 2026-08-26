"""Response envelopes and pagination, per section 1 of the API contract."""

from math import ceil
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

from app.schemas.base import CamelModel

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class DataResponse(BaseModel, Generic[T]):
    """Single resource: ``{"data": {...}}``."""

    data: T


class PageMeta(CamelModel):
    page: int
    limit: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    """Collection: ``{"data": [...], "pagination": {...}}``."""

    data: list[T]
    pagination: PageMeta


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit

    def meta(self, total: int) -> PageMeta:
        return PageMeta(
            page=self.page,
            limit=self.limit,
            total=total,
            total_pages=ceil(total / self.limit) if total else 0,
        )


def pagination_params(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> PaginationParams:
    """FastAPI dependency for ``?page=&limit=``."""
    return PaginationParams(page=page, limit=limit)
