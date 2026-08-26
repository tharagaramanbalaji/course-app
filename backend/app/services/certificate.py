"""Certificate retrieval and public verification (section 20)."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.certificate import Certificate
from app.models.enums import EnrollmentStatus
from app.models.user import User
from app.repositories.certificate import CertificateRepository
from app.repositories.enrollment import EnrollmentRepository
from app.schemas.certificate import CertificateVerification
from app.services.authoring import AuthoringGuard


class CertificateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.certificates = CertificateRepository(session)
        self.enrollments = EnrollmentRepository(session)
        self.guard = AuthoringGuard(session)

    async def list_for_learner(self, learner: User) -> Sequence[Certificate]:
        return await self.certificates.list_for_user(learner.id)

    async def get_for_learner(self, learner: User, certificate_id: UUID) -> Certificate:
        """Ownership is checked through the enrollment, so one learner cannot
        read another's certificate by id."""
        certificate = await self.certificates.get(certificate_id)
        if certificate is None:
            raise NotFoundError("Certificate not found.")

        enrollment = await self.enrollments.get(certificate.enrollment_id)
        if enrollment is None or enrollment.user_id != learner.id:
            raise NotFoundError("Certificate not found.")
        return certificate

    async def get_for_course(self, learner: User, course_id: UUID) -> Certificate:
        enrollment = await self.enrollments.get_for_user_and_course(learner.id, course_id)
        if enrollment is None:
            raise NotFoundError("You are not enrolled in this course.")

        certificate = await self.certificates.get_by_enrollment(enrollment.id)
        if certificate is None:
            if enrollment.status is not EnrollmentStatus.COMPLETED:
                raise BusinessRuleError(
                    "This course is not complete yet, so no certificate exists."
                )
            raise NotFoundError("Certificate not found.")
        return certificate

    async def verify(self, certificate_number: str) -> CertificateVerification:
        """Public lookup by number.

        Returns only what is safe to publish: no user id, no enrollment id,
        no course id. A missing number is reported as invalid rather than as
        an error, since this endpoint exists to answer yes or no.
        """
        certificate = await self.certificates.get_by_number(certificate_number.strip())
        if certificate is None:
            raise NotFoundError("No certificate exists with that number.")

        return CertificateVerification(
            valid=True,
            certificate_number=certificate.certificate_number,
            participant_name=certificate.participant_name,
            course_name=certificate.course_name,
            completion_date=certificate.completion_date,
            final_score=certificate.final_score,
        )

    async def list_for_course(self, author: User, course_id: UUID) -> Sequence[Certificate]:
        """Owner-scoped: certificates for learners who completed this course."""
        await self.guard.course(author, course_id)

        enrollments = await self.enrollments.list_by_course(course_id)
        results: list[Certificate] = []
        for enrollment in enrollments:
            certificate = await self.certificates.get_by_enrollment(enrollment.id)
            if certificate is not None:
                results.append(certificate)
        return results

    @staticmethod
    def as_text(certificate: Certificate) -> str:
        """A plain-text certificate, served as the download.

        PDF rendering is a presentation concern and is deliberately left out
        of V1; the endpoint contract and the stored record are what matter.
        """
        date = certificate.completion_date.strftime("%d %B %Y")
        return "\n".join(
            [
                "CERTIFICATE OF COMPLETION",
                "",
                f"Participant:  {certificate.participant_name}",
                f"Course:       {certificate.course_name}",
                f"Completed:    {date}",
                f"Final score:  {certificate.final_score}%",
                f"Certificate:  {certificate.certificate_number}",
                "",
                "Verify this certificate at /api/v1/certificates/verify/"
                f"{certificate.certificate_number}",
                "",
            ]
        )
