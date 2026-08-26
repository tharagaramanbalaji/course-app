"""Learner actions and reads under /my (sections 12 to 21).

Nothing here accepts a score, a pass flag, a completion state, an attempt
number or a certificate from the client. Every one of those is derived.
"""

from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.attempt import (
    AttemptResultRead,
    AttemptStartRead,
    AttemptSubmit,
    AttemptSummary,
)
from app.schemas.certificate import CertificateRead
from app.schemas.common import DataResponse
from app.schemas.dashboard import UserDashboard
from app.schemas.progress import ContentCompletionRead
from app.services.certificate import CertificateService
from app.services.dashboard import DashboardService
from app.services.learning import LearningService

router = APIRouter(prefix="/my", tags=["learning"])


@router.get("/dashboard", response_model=DataResponse[UserDashboard])
async def my_dashboard(learner: CurrentUser, db: DbSession) -> DataResponse[UserDashboard]:
    """Only the authenticated learner's own data."""
    return DataResponse(data=await DashboardService(db).user_dashboard(learner))


@router.post(
    "/courses/{course_id}/modules/{module_id}/contents/{content_id}/complete",
    response_model=DataResponse[ContentCompletionRead],
)
async def complete_content(
    course_id: UUID,
    module_id: UUID,
    content_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[ContentCompletionRead]:
    """Record that content was consumed, then recompute module and course
    completion. Idempotent: repeat calls do not create a second record."""
    result = await LearningService(db).complete_content(
        learner, course_id, module_id, content_id
    )
    return DataResponse(data=result)


@router.post(
    "/courses/{course_id}/modules/{module_id}/quiz/attempts",
    response_model=DataResponse[AttemptStartRead],
    status_code=status.HTTP_201_CREATED,
)
async def start_attempt(
    course_id: UUID,
    module_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[AttemptStartRead]:
    """The backend assigns the attempt number and enforces max_attempts.
    An unsubmitted attempt is resumed rather than duplicated."""
    return DataResponse(data=await LearningService(db).start_attempt(learner, course_id, module_id))


@router.get(
    "/courses/{course_id}/modules/{module_id}/quiz/attempts",
    response_model=DataResponse[list[AttemptSummary]],
)
async def list_attempts(
    course_id: UUID,
    module_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[list[AttemptSummary]]:
    attempts = await LearningService(db).list_attempts(learner, course_id, module_id)
    return DataResponse(data=[AttemptSummary.model_validate(a) for a in attempts])


@router.post(
    "/courses/{course_id}/modules/{module_id}/quiz/attempts/{attempt_id}/submit",
    response_model=DataResponse[AttemptResultRead],
)
async def submit_attempt(
    course_id: UUID,
    module_id: UUID,
    attempt_id: UUID,
    payload: AttemptSubmit,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[AttemptResultRead]:
    """Scores from the database, then cascades module completion, course
    completion and certificate generation in one transaction."""
    result = await LearningService(db).submit_attempt(
        learner, course_id, module_id, attempt_id, payload
    )
    return DataResponse(data=result)


# --- certificates (section 20) ---------------------------------------


@router.get("/certificates", response_model=DataResponse[list[CertificateRead]])
async def my_certificates(
    learner: CurrentUser, db: DbSession
) -> DataResponse[list[CertificateRead]]:
    certificates = await CertificateService(db).list_for_learner(learner)
    return DataResponse(data=[CertificateRead.model_validate(c) for c in certificates])


@router.get("/certificates/{certificate_id}", response_model=DataResponse[CertificateRead])
async def my_certificate(
    certificate_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[CertificateRead]:
    certificate = await CertificateService(db).get_for_learner(learner, certificate_id)
    return DataResponse(data=CertificateRead.model_validate(certificate))


@router.get("/certificates/{certificate_id}/download")
async def download_certificate(
    certificate_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> Response:
    """Served as a text attachment. Rendering it as a PDF is a presentation
    concern and is deliberately out of scope for V1."""
    service = CertificateService(db)
    certificate = await service.get_for_learner(learner, certificate_id)
    filename = f"{certificate.certificate_number}.txt"

    return Response(
        content=service.as_text(certificate),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/courses/{course_id}/certificate", response_model=DataResponse[CertificateRead])
async def my_course_certificate(
    course_id: UUID,
    learner: CurrentUser,
    db: DbSession,
) -> DataResponse[CertificateRead]:
    certificate = await CertificateService(db).get_for_course(learner, course_id)
    return DataResponse(data=CertificateRead.model_validate(certificate))
