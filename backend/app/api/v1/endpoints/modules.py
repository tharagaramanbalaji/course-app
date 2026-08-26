"""Module endpoints (section 5).

Reads are role-dependent: an owner gets the authoring representation, a
learner gets a safe one carrying their progress and unlock state.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.schemas.common import DataResponse
from app.schemas.module import (
    ModuleCreate,
    ModuleLearnerRead,
    ModuleRead,
    ModuleReorder,
    ModuleUpdate,
)
from app.services.enrollment import EnrollmentService
from app.services.module import ModuleService

router = APIRouter(prefix="/courses/{course_id}/modules", tags=["modules"])

# FastAPI is told response_model=None for the role-dependent reads below.
# Declaring the union instead lets pydantic's smart union pick whichever
# member validates "best", which silently drops isCorrect from an author's
# response. Returning the model the endpoint actually built serialises it
# exactly, aliases included.
ModuleView = DataResponse[ModuleRead] | DataResponse[ModuleLearnerRead]
ModuleListView = DataResponse[list[ModuleRead]] | DataResponse[list[ModuleLearnerRead]]


@router.post("", response_model=DataResponse[ModuleRead], status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: UUID,
    payload: ModuleCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[ModuleRead]:
    module = await ModuleService(db).create_module(author, course_id, payload)
    return DataResponse(data=ModuleRead.model_validate(module))


@router.get("", response_model=None)
async def list_modules(course_id: UUID, viewer: CurrentUser, db: DbSession) -> ModuleListView:
    service = ModuleService(db)

    if viewer.role.can_author_courses:
        modules = await service.list_for_author(viewer, course_id)
        return DataResponse(data=[ModuleRead.model_validate(m) for m in modules])

    enrollment = await EnrollmentService(db).require_enrollment(viewer, course_id)
    return DataResponse(data=await service.list_for_learner(enrollment, course_id))


# Declared before /{module_id} so "reorder" is not parsed as a module id.
@router.patch("/reorder", response_model=DataResponse[list[ModuleRead]])
async def reorder_modules(
    course_id: UUID,
    payload: ModuleReorder,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[list[ModuleRead]]:
    """The list must be a permutation of the course's existing modules."""
    modules = await ModuleService(db).reorder_modules(author, course_id, payload)
    return DataResponse(data=[ModuleRead.model_validate(m) for m in modules])


@router.get("/{module_id}", response_model=None)
async def get_module(
    course_id: UUID,
    module_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> ModuleView:
    service = ModuleService(db)

    if viewer.role.can_author_courses:
        module = await service.get_for_author(viewer, course_id, module_id)
        return DataResponse(data=ModuleRead.model_validate(module))

    enrollment = await EnrollmentService(db).require_enrollment(viewer, course_id)
    return DataResponse(data=await service.get_for_learner(enrollment, course_id, module_id))


@router.patch("/{module_id}", response_model=DataResponse[ModuleRead])
async def update_module(
    course_id: UUID,
    module_id: UUID,
    payload: ModuleUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[ModuleRead]:
    module = await ModuleService(db).update_module(author, course_id, module_id, payload)
    return DataResponse(data=ModuleRead.model_validate(module))


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    course_id: UUID,
    module_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> None:
    await ModuleService(db).delete_module(author, course_id, module_id)
