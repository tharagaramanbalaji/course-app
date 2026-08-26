"""Admin and instructor dashboards and reports (sections 22 to 25).

Every response is scoped to courses the caller owns. There is deliberately
no endpoint that returns data across all owners.
"""

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AuthorUser, DbSession
from app.schemas.certificate import CertificateRead
from app.schemas.common import DataResponse
from app.schemas.dashboard import (
    AdminOverview,
    CompletionRow,
    CourseProgressReport,
    CourseStat,
    LearnerProgressDetail,
    LearnerProgressRow,
    LearnerStat,
    QuizResultRow,
)
from app.services.certificate import CertificateService
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/admin/dashboard", tags=["admin"])
course_router = APIRouter(prefix="/courses", tags=["admin"])


@router.get("/overview", response_model=DataResponse[AdminOverview])
async def overview(author: AuthorUser, db: DbSession) -> DataResponse[AdminOverview]:
    return DataResponse(data=await DashboardService(db).admin_overview(author))


@router.get("/courses", response_model=DataResponse[list[CourseStat]])
async def course_stats(author: AuthorUser, db: DbSession) -> DataResponse[list[CourseStat]]:
    return DataResponse(data=await DashboardService(db).admin_courses(author))


@router.get("/users", response_model=DataResponse[list[LearnerStat]])
async def learner_stats(author: AuthorUser, db: DbSession) -> DataResponse[list[LearnerStat]]:
    """Learners reachable through owned courses, and nobody else."""
    return DataResponse(data=await DashboardService(db).admin_users(author))


@router.get("/progress", response_model=DataResponse[list[LearnerProgressRow]])
async def progress(
    author: AuthorUser, db: DbSession
) -> DataResponse[list[LearnerProgressRow]]:
    return DataResponse(data=await DashboardService(db).admin_progress(author))


@router.get("/quiz-results", response_model=DataResponse[list[QuizResultRow]])
async def quiz_results(author: AuthorUser, db: DbSession) -> DataResponse[list[QuizResultRow]]:
    return DataResponse(data=await DashboardService(db).admin_quiz_results(author))


@router.get("/completions", response_model=DataResponse[list[CompletionRow]])
async def completions(author: AuthorUser, db: DbSession) -> DataResponse[list[CompletionRow]]:
    return DataResponse(data=await DashboardService(db).admin_completions(author))


# --- per-course reports ----------------------------------------------


@course_router.get("/{course_id}/progress", response_model=DataResponse[CourseProgressReport])
async def course_progress(
    course_id: UUID, author: AuthorUser, db: DbSession
) -> DataResponse[CourseProgressReport]:
    return DataResponse(data=await DashboardService(db).course_progress(author, course_id))


@course_router.get(
    "/{course_id}/users/{user_id}/progress",
    response_model=DataResponse[LearnerProgressDetail],
)
async def learner_progress(
    course_id: UUID, user_id: UUID, author: AuthorUser, db: DbSession
) -> DataResponse[LearnerProgressDetail]:
    return DataResponse(
        data=await DashboardService(db).learner_progress(author, course_id, user_id)
    )


@course_router.get("/{course_id}/quiz-results", response_model=DataResponse[list[QuizResultRow]])
async def course_quiz_results(
    course_id: UUID, author: AuthorUser, db: DbSession
) -> DataResponse[list[QuizResultRow]]:
    return DataResponse(data=await DashboardService(db).course_quiz_results(author, course_id))


@course_router.get(
    "/{course_id}/certificates", response_model=DataResponse[list[CertificateRead]]
)
async def course_certificates(
    course_id: UUID, author: AuthorUser, db: DbSession
) -> DataResponse[list[CertificateRead]]:
    certificates = await CertificateService(db).list_for_course(author, course_id)
    return DataResponse(data=[CertificateRead.model_validate(c) for c in certificates])
