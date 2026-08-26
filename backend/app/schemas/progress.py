"""Progress payloads (sections 12 and 18)."""

from datetime import datetime
from uuid import UUID

from app.models.enums import ProgressStatus
from app.schemas.attempt import CertificateSummary
from app.schemas.base import CamelModel


class ModuleProgressRead(CamelModel):
    module_id: UUID
    status: ProgressStatus
    content_completed: bool
    quiz_passed: bool
    completed_at: datetime | None


class ContentCompletionRead(CamelModel):
    """The result of marking content complete, with everything the backend
    recalculated as a consequence."""

    content_id: UUID
    completed: bool
    completed_at: datetime | None
    module: ModuleProgressRead
    module_completed: bool
    course_completed: bool
    certificate: CertificateSummary | None = None
