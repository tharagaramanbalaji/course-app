"""Course management endpoints (section 4)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.models.enums import CourseStatus
from app.schemas.common import DataResponse, PaginatedResponse, PaginationParams, pagination_params
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.services.course import CourseService

router = APIRouter(prefix="/courses", tags=["courses"])

Pagination = Annotated[PaginationParams, Depends(pagination_params)]


@router.post("", response_model=DataResponse[CourseRead], status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    """The server sets id, createdBy, status=DRAFT and the timestamps."""
    course = await CourseService(db).create_course(author, payload)
    return DataResponse(data=CourseRead.model_validate(course))


@router.get("", response_model=PaginatedResponse[CourseRead])
async def list_courses(
    viewer: CurrentUser,
    db: DbSession,
    pagination: Pagination,
    search: Annotated[str | None, Query(max_length=255)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    course_status: Annotated[CourseStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[CourseRead]:
    """Authors get their own courses; learners get the published catalogue."""
    courses, total = await CourseService(db).list_courses(
        viewer, pagination, search=search, category=category, status=course_status
    )
    return PaginatedResponse(
        data=[CourseRead.model_validate(c) for c in courses],
        pagination=pagination.meta(total),
    )


@router.get("/{course_id}", response_model=DataResponse[CourseRead])
async def get_course(
    course_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    course = await CourseService(db).get_course(viewer, course_id)
    return DataResponse(data=CourseRead.model_validate(course))


@router.patch("/{course_id}", response_model=DataResponse[CourseRead])
async def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    """Owner only, and only while the course is still a DRAFT."""
    course = await CourseService(db).update_course(author, course_id, payload)
    return DataResponse(data=CourseRead.model_validate(course))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: UUID, author: AuthorUser, db: DbSession) -> None:
    """Owner only, DRAFT only: published course data is historical."""
    await CourseService(db).delete_course(author, course_id)


@router.post("/{course_id}/publish", response_model=DataResponse[CourseRead])
async def publish_course(
    course_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    """Validate the whole course tree, then publish it in one transaction."""
    course = await CourseService(db).publish_course(author, course_id)
    return DataResponse(data=CourseRead.model_validate(course))
