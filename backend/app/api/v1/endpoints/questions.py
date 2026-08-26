"""Question endpoints (section 8), addressed by quiz id."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthorUser, CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.common import DataResponse
from app.schemas.quiz import (
    QuestionCreate,
    QuestionLearnerRead,
    QuestionRead,
    QuestionReorder,
    QuestionUpdate,
)
from app.services.quiz import QuizService

router = APIRouter(prefix="/quizzes/{quiz_id}/questions", tags=["questions"])

# FastAPI is told response_model=None for the role-dependent reads below.
# Declaring the union instead lets pydantic's smart union pick whichever
# member validates "best", which silently drops isCorrect from an author's
# response. Returning the model the endpoint actually built serialises it
# exactly, aliases included.
QuestionView = DataResponse[QuestionRead] | DataResponse[QuestionLearnerRead]
QuestionListView = (
    DataResponse[list[QuestionRead]] | DataResponse[list[QuestionLearnerRead]]
)


@router.post("", response_model=DataResponse[QuestionRead], status_code=status.HTTP_201_CREATED)
async def create_question(
    quiz_id: UUID,
    payload: QuestionCreate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[QuestionRead]:
    question = await QuizService(db).create_question(author, quiz_id, payload)
    return DataResponse(data=QuestionRead.model_validate(question))


@router.get("", response_model=None)
async def list_questions(
    quiz_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> QuestionListView:
    """Learners receive questions with no correctness information at all."""
    service = QuizService(db)

    if viewer.role.can_author_courses:
        questions = await service.list_questions_for_author(viewer, quiz_id)
        return DataResponse(data=[QuestionRead.model_validate(q) for q in questions])

    await service.require_learner_quiz(viewer, quiz_id)
    return DataResponse(data=await service.list_questions_for_learner(quiz_id))


# Declared before /{question_id} so "reorder" is not parsed as a question id.
@router.patch("/reorder", response_model=DataResponse[list[QuestionRead]])
async def reorder_questions(
    quiz_id: UUID,
    payload: QuestionReorder,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[list[QuestionRead]]:
    questions = await QuizService(db).reorder_questions(author, quiz_id, payload)
    return DataResponse(data=[QuestionRead.model_validate(q) for q in questions])


@router.get("/{question_id}", response_model=None)
async def get_question(
    quiz_id: UUID,
    question_id: UUID,
    viewer: CurrentUser,
    db: DbSession,
) -> QuestionView:
    service = QuizService(db)

    if viewer.role.can_author_courses:
        question = await service.get_question_for_author(viewer, quiz_id, question_id)
        return DataResponse(data=QuestionRead.model_validate(question))

    await service.require_learner_quiz(viewer, quiz_id)
    for question in await service.list_questions_for_learner(quiz_id):
        if question.id == question_id:
            return DataResponse(data=question)
    raise NotFoundError("Question not found in this quiz.")


@router.patch("/{question_id}", response_model=DataResponse[QuestionRead])
async def update_question(
    quiz_id: UUID,
    question_id: UUID,
    payload: QuestionUpdate,
    author: AuthorUser,
    db: DbSession,
) -> DataResponse[QuestionRead]:
    question = await QuizService(db).update_question(author, quiz_id, question_id, payload)
    return DataResponse(data=QuestionRead.model_validate(question))


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    quiz_id: UUID,
    question_id: UUID,
    author: AuthorUser,
    db: DbSession,
) -> None:
    await QuizService(db).delete_question(author, quiz_id, question_id)
