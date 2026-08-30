"""Tests for PDFMonkey certificate rendering and download."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.certificate import Certificate
from app.models.enums import UserRole
from app.services.certificate import CertificateService
from app.services.pdfmonkey import PDFMonkeyService
from tests import factories as f
from tests.test_progression_api import _build_course, _enrolled_learner, _my, _selections


@pytest.mark.asyncio
async def test_pdfmonkey_service_generate_pdf_mocked():
    service = PDFMonkeyService()
    service.api_key = "test-key"
    service.template_id = "test-template"

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=201,
            json=lambda: {
                "document": {
                    "id": "doc-123",
                    "status": "success",
                    "download_url": "https://download.pdfmonkey.io/certs/test.pdf",
                }
            },
        )
        url = await service.generate_certificate_pdf(
            participant_name="Alice",
            course_name="FastAPI Mastery",
            completion_date="30 August 2026",
            certificate_number="CERT-2026-1234",
            final_score="100.00",
            verification_url="http://localhost:5173/verify/CERT-2026-1234",
        )
        assert url == "https://download.pdfmonkey.io/certs/test.pdf"


@pytest.mark.asyncio
async def test_certificate_download_returns_pdf_when_url_available(client, db_session):
    author = await f.make_user(db_session, email="alice_cert@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    entry = mods[0]
    learner, headers = await _enrolled_learner(client, db_session, course, email="bob_cert@example.com")
    base = _my(course.id, entry["module"].id)

    await client.post(f"{base}/contents/{entry['content'].id}/complete", headers=headers)
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    result = await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"])},
    )
    cert_id = result.json()["data"]["certificate"]["id"]

    fake_pdf_bytes = b"%PDF-1.4 Mock PDF Binary Data"

    with patch.object(CertificateService, "get_pdf_bytes", new_callable=AsyncMock) as mock_get_pdf:
        mock_get_pdf.return_value = fake_pdf_bytes

        response = await client.get(f"/api/v1/my/certificates/{cert_id}/download", headers=headers)

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert ".pdf" in response.headers["content-disposition"]
        assert response.content == fake_pdf_bytes
