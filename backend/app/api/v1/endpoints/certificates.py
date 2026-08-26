"""Public certificate verification (section 20)."""

from fastapi import APIRouter, Path

from app.api.deps import DbSession
from app.schemas.certificate import CertificateVerification
from app.schemas.common import DataResponse
from app.services.certificate import CertificateService

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.get("/verify/{certificate_number}", response_model=DataResponse[CertificateVerification])
async def verify_certificate(
    db: DbSession,
    certificate_number: str = Path(min_length=1, max_length=100),
) -> DataResponse[CertificateVerification]:
    """Public: no authentication required.

    Returns only publishable fields. No user id, enrollment id or course id
    is exposed, since a certificate number is meant to be shared.
    """
    return DataResponse(data=await CertificateService(db).verify(certificate_number))
