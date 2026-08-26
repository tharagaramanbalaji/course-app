"""Self-enrollment and the learner's own courses (section 11)."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import DataResponse
from app.schemas.enrollment import EnrollmentRead, MyCourseRead
from app.services.enrollment import EnrollmentService

enroll_router = APIRouter(prefix="/courses", tags=["enrollment"])
my_router = APIRouter(prefix="/my", tags=["enrollment"])


@enroll_router.post(
    "/{course_id}/enroll",
    response_model=DataResponse[EnrollmentRead],
    status_code=status.HTTP_201_CREATED,
)
async def self_enroll(
    course_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[EnrollmentRead]:
    """Requires a PUBLISHED course with allowSelfEnrollment set."""
    enrollment = await EnrollmentService(db).self_enroll(learner, course_id)
    return DataResponse(data=EnrollmentRead.model_validate(enrollment))


@my_router.get("/courses", response_model=DataResponse[list[MyCourseRead]])
async def my_courses(learner: CurrentUser, db: DbSession) -> DataResponse[list[MyCourseRead]]:
    """Assigned and self-enrolled courses alike, with progress and the
    assignment behind them where there was one."""
    return DataResponse(data=await EnrollmentService(db).my_courses(learner))


@my_router.get("/courses/{course_id}", response_model=DataResponse[MyCourseRead])
async def my_course(
    course_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[MyCourseRead]:
    return DataResponse(data=await EnrollmentService(db).my_course(learner, course_id))
