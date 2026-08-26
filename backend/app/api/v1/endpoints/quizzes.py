"""Quiz endpoints (section 7).

The learner representation is a different schema, not a filtered one: it
has no ``isCorrect`` field anywhere in its tree, so correctness cannot leak
through a forgotten exclude.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.schemas.common import DataResponse
from app.schemas.quiz import QuizCreate, QuizLearnerRead, QuizRead, QuizUpdate
from app.services.enrollment import EnrollmentService
from app.services.quiz import QuizService

router = APIRouter(
    prefix="/courses/{course_id}/modules/{module_id}/quiz",
    tags=["quizzes"],
)

# FastAPI is told response_model=None for the role-dependent reads below.
# Declaring the union instead lets pydantic's smart union pick whichever
# member validates "best", which silently drops isCorrect from an author's
# response. Returning the model the endpoint actually built serialises it
# exactly, aliases included.

QuizView = DataResponse[QuizRead] | DataResponse[QuizLearnerRead]


@router.post("", response_model=DataResponse[QuizRead], status_code=status.HTTP_201_CREATED)
async def create_quiz(
    course_id: UUID,
    module_id: UUID,
    payload: QuizCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[QuizRead]:
    """One quiz per module in V1; a second attempt is a conflict."""
    quiz = await QuizService(db).create_quiz(author, course_id, module_id, payload)
    return DataResponse(data=QuizRead.model_validate(quiz))


@router.get("", response_model=None)
async def get_quiz(
    course_id: UUID,
    module_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> QuizView:
    service = QuizService(db)

    if viewer.role.can_author_courses:
        quiz = await service.get_for_author(viewer, course_id, module_id)
        return DataResponse(data=QuizRead.model_validate(quiz))

    enrollment = await EnrollmentService(db).require_enrollment(viewer, course_id)
    return DataResponse(data=await service.get_for_learner(enrollment, module_id))


@router.patch("", response_model=DataResponse[QuizRead])
async def update_quiz(
    course_id: UUID,
    module_id: UUID,
    payload: QuizUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[QuizRead]:
    quiz = await QuizService(db).update_quiz(author, course_id, module_id, payload)
    return DataResponse(data=QuizRead.model_validate(quiz))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    course_id: UUID,
    module_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> None:
    await QuizService(db).delete_quiz(author, course_id, module_id)
