"""Assignment endpoints (section 10)."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.schemas.common import DataResponse
from app.services.assignment import AssignmentService

course_router = APIRouter(prefix="/courses/{course_id}/assignments", tags=["assignments"])
router = APIRouter(prefix="/assignments", tags=["assignments"])


@course_router.post(
    "", response_model=DataResponse[AssignmentRead], status_code=status.HTTP_201_CREATED
)
async def create_assignment(
    course_id: UUID,
    payload: AssignmentCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[AssignmentRead]:
    """Assigns a published course and establishes the learner's enrollment
    in the same transaction."""
    assignment = await AssignmentService(db).create_assignment(author, course_id, payload)
    return DataResponse(data=AssignmentRead.model_validate(assignment))


@course_router.get("", response_model=DataResponse[list[AssignmentRead]])
async def list_course_assignments(
    course_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[list[AssignmentRead]]:
    assignments = await AssignmentService(db).list_for_course(author, course_id)
    return DataResponse(data=[AssignmentRead.model_validate(a) for a in assignments])


@router.get("/{assignment_id}", response_model=DataResponse[AssignmentRead])
async def get_assignment(
    assignment_id: UUID,
    caller: CurrentUser,
    db: DbSession,
) -> DataResponse[AssignmentRead]:
    """Authors reach assignments on courses they own; a learner reaches only
    their own."""
    assignment = await AssignmentService(db).get_assignment(caller, assignment_id)
    return DataResponse(data=AssignmentRead.model_validate(assignment))


@router.patch("/{assignment_id}", response_model=DataResponse[AssignmentRead])
async def update_assignment(
    assignment_id: UUID,
    payload: AssignmentUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[AssignmentRead]:
    assignment = await AssignmentService(db).update_assignment(author, assignment_id, payload)
    return DataResponse(data=AssignmentRead.model_validate(assignment))


@router.delete("/{assignment_id}", response_model=DataResponse[AssignmentRead])
async def cancel_assignment(
    assignment_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[AssignmentRead]:
    """Cancels rather than deletes, so the historical record and any progress
    the learner has made both survive."""
    assignment = await AssignmentService(db).cancel_assignment(author, assignment_id)
    return DataResponse(data=AssignmentRead.model_validate(assignment))
