"""Course management endpoints (section 4)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.models.enums import CourseStatus
from app.repositories.course import CourseRepository
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


@router.get("/{course_id}/syllabus")
async def get_course_syllabus(
    course_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
):
    """Syllabus preview for learners/guests before enrolling."""
    course = await CourseRepository(db).get_with_structure(course_id)
    if course is None or (course.status != CourseStatus.PUBLISHED and not viewer.role.can_author_courses):
        raise NotFoundError("Course not found.")

    modules = []
    for m in sorted(course.modules, key=lambda x: x.display_order):
        contents = [
            {
                "id": str(c.id),
                "title": c.title,
                "contentType": c.content_type.value,
                "displayOrder": c.display_order,
            }
            for c in sorted(m.contents, key=lambda x: x.display_order)
        ]
        quiz = None
        if m.quiz:
            quiz = {
                "id": str(m.quiz.id),
                "title": m.quiz.title,
                "passingScore": float(m.quiz.passing_score),
            }
        modules.append({
            "id": str(m.id),
            "title": m.title,
            "description": m.description,
            "displayOrder": m.display_order,
            "contents": contents,
            "quiz": quiz,
        })

    return DataResponse(
        data={
            "id": str(course.id),
            "title": course.title,
            "category": course.category,
            "description": course.description,
            "allowSelfEnrollment": course.allow_self_enrollment,
            "modules": modules,
        }
    )


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


@router.post("/{course_id}/unpublish", response_model=DataResponse[CourseRead])
async def unpublish_course(
    course_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    """Owner only. Returns a PUBLISHED course to DRAFT so it can be edited
    again, then republished - the sanctioned route around "no post-publication
    editing" rather than an exception to it."""
    course = await CourseService(db).unpublish_course(author, course_id)
    return DataResponse(data=CourseRead.model_validate(course))


@router.post("/{course_id}/archive", response_model=DataResponse[CourseRead])
async def archive_course(
    course_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[CourseRead]:
    """Owner only. Retires a course (from DRAFT or PUBLISHED) without
    deleting it, so certificates and completions stay intact."""
    course = await CourseService(db).archive_course(author, course_id)
    return DataResponse(data=CourseRead.model_validate(course))
