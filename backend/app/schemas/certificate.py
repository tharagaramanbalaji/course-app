"""Certificate payloads (section 20)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.schemas.base import CamelModel


class CertificateRead(CamelModel):
    id: UUID
    certificate_number: str
    enrollment_id: UUID
    participant_name: str
    course_name: str
    completion_date: datetime
    final_score: Decimal
    certificate_url: str | None
    created_at: datetime


class CertificateVerification(CamelModel):
    """The public verification view.

    Deliberately omits enrollment and user identifiers: a certificate number
    is shareable, so anything reachable through it must be safe to publish.
    """

    valid: bool
    certificate_number: str
    participant_name: str
    course_name: str
    completion_date: datetime
    final_score: Decimal
