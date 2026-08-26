"""Answer endpoints (section 9), addressed by question id.

The learner list returns ``AnswerLearnerRead``, which has no ``isCorrect``
field. This is the single most important read in the API to get right:
leaking correctness here would make every quiz result meaningless.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.schemas.common import DataResponse
from app.schemas.quiz import AnswerCreate, AnswerLearnerRead, AnswerRead, AnswerUpdate
from app.services.quiz import QuizService

router = APIRouter(prefix="/questions/{question_id}/answers", tags=["answers"])

# FastAPI is told response_model=None for the role-dependent reads below.
# Declaring the union instead lets pydantic's smart union pick whichever
# member validates "best", which silently drops isCorrect from an author's
# response. Returning the model the endpoint actually built serialises it
# exactly, aliases included.

AnswerListView = DataResponse[list[AnswerRead]] | DataResponse[list[AnswerLearnerRead]]


@router.post("", response_model=DataResponse[AnswerRead], status_code=status.HTTP_201_CREATED)
async def create_answer(
    question_id: UUID,
    payload: AnswerCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[AnswerRead]:
    answer = await QuizService(db).create_answer(author, question_id, payload)
    return DataResponse(data=AnswerRead.model_validate(answer))


@router.get("", response_model=None)
async def list_answers(
    question_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> AnswerListView:
    service = QuizService(db)

    if viewer.role.can_author_courses:
        answers = await service.list_answers_for_author(viewer, question_id)
        return DataResponse(data=[AnswerRead.model_validate(a) for a in answers])

    question = await service.require_learner_question(viewer, question_id)
    return DataResponse(
        data=[AnswerLearnerRead.model_validate(a) for a in question.answers]
    )


@router.patch("/{answer_id}", response_model=DataResponse[AnswerRead])
async def update_answer(
    question_id: UUID,
    answer_id: UUID,
    payload: AnswerUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[AnswerRead]:
    answer = await QuizService(db).update_answer(author, question_id, answer_id, payload)
    return DataResponse(data=AnswerRead.model_validate(answer))


@router.delete("/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(
    question_id: UUID,
    answer_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> None:
    await QuizService(db).delete_answer(author, question_id, answer_id)
