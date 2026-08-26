"""Training content endpoints (section 6)."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.common import DataResponse
from app.schemas.content import (
    ContentCreate,
    ContentLearnerRead,
    ContentRead,
    ContentReorder,
    ContentUpdate,
)
from app.services.content import ContentService
from app.services.enrollment import EnrollmentService
from app.services.module import ModuleService

router = APIRouter(
    prefix="/courses/{course_id}/modules/{module_id}/contents",
    tags=["contents"],
)

# FastAPI is told response_model=None for the role-dependent reads below.
# Declaring the union instead lets pydantic's smart union pick whichever
# member validates "best", which silently drops isCorrect from an author's
# response. Returning the model the endpoint actually built serialises it
# exactly, aliases included.
ContentView = DataResponse[ContentRead] | DataResponse[ContentLearnerRead]
ContentListView = DataResponse[list[ContentRead]] | DataResponse[list[ContentLearnerRead]]


async def _learner_module(db, viewer, course_id: UUID, module_id: UUID):
    """A learner may only reach content in a module the backend has unlocked."""
    enrollment = await EnrollmentService(db).require_enrollment(viewer, course_id)
    module = await ModuleService(db).get_for_learner(enrollment, course_id, module_id)
    if not module.unlocked:
        raise NotFoundError(
            "This module is locked. Complete the previous module first."
        )
    return enrollment


@router.post("", response_model=DataResponse[ContentRead], status_code=status.HTTP_201_CREATED)
async def create_content(
    course_id: UUID,
    module_id: UUID,
    payload: ContentCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[ContentRead]:
    content = await ContentService(db).create_content(author, course_id, module_id, payload)
    return DataResponse(data=ContentRead.model_validate(content))


@router.get("", response_model=None)
async def list_contents(
    course_id: UUID,
    module_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> ContentListView:
    service = ContentService(db)

    if viewer.role.can_author_courses:
        contents = await service.list_for_author(viewer, course_id, module_id)
        return DataResponse(data=[ContentRead.model_validate(c) for c in contents])

    enrollment = await _learner_module(db, viewer, course_id, module_id)
    return DataResponse(data=await service.list_for_learner(enrollment, module_id))


# Declared before /{content_id} so "reorder" is not parsed as a content id.
@router.patch("/reorder", response_model=DataResponse[list[ContentRead]])
async def reorder_contents(
    course_id: UUID,
    module_id: UUID,
    payload: ContentReorder,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[list[ContentRead]]:
    contents = await ContentService(db).reorder_contents(author, course_id, module_id, payload)
    return DataResponse(data=[ContentRead.model_validate(c) for c in contents])


@router.get("/{content_id}", response_model=None)
async def get_content(
    course_id: UUID,
    module_id: UUID,
    content_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> ContentView:
    service = ContentService(db)

    if viewer.role.can_author_courses:
        content = await service.get_for_author(viewer, course_id, module_id, content_id)
        return DataResponse(data=ContentRead.model_validate(content))

    enrollment = await _learner_module(db, viewer, course_id, module_id)
    contents = await service.list_for_learner(enrollment, module_id)
    for content in contents:
        if content.id == content_id:
            return DataResponse(data=content)
    raise NotFoundError("Content not found in this module.")


@router.patch("/{content_id}", response_model=DataResponse[ContentRead])
async def update_content(
    course_id: UUID,
    module_id: UUID,
    content_id: UUID,
    payload: ContentUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[ContentRead]:
    content = await ContentService(db).update_content(
        author, course_id, module_id, content_id, payload
    )
    return DataResponse(data=ContentRead.model_validate(content))


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    course_id: UUID,
    module_id: UUID,
    content_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> None:
    await ContentService(db).delete_content(author, course_id, module_id, content_id)
