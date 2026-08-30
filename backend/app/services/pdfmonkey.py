"""PDFMonkey integration service for automated certificate generation."""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class PDFMonkeyService:
    """Handles communication with the PDFMonkey API."""

    def __init__(self) -> None:
        self.api_key = settings.PDFMONKEY_API_KEY.strip()
        self.template_id = settings.PDFMONKEY_TEMPLATE_ID.strip()
        self.base_url = settings.PDFMONKEY_BASE_URL.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.template_id)

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate_certificate_pdf(
        self,
        participant_name: str,
        course_name: str,
        completion_date: str,
        certificate_number: str,
        final_score: str,
        verification_url: str = "",
    ) -> str | None:
        """Create a certificate document on PDFMonkey and poll for the download URL.

        Returns the public download URL if generated successfully, or None.
        """
        if not self.is_configured:
            logger.debug("PDFMonkey is not configured; skipping PDF generation.")
            return None

        payload: dict[str, Any] = {
            "document": {
                "document_template_id": self.template_id,
                "status": "pending",
                "payload": {
                    "participant_name": participant_name,
                    "course_name": course_name,
                    "completion_date": completion_date,
                    "certificate_number": certificate_number,
                    "final_score": str(final_score),
                    "verification_url": verification_url,
                },
                "meta": {
                    "_filename": f"{certificate_number}.pdf",
                },
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"{self.base_url}/documents",
                    json=payload,
                    headers=self.headers,
                )
                if res.status_code not in (200, 201):
                    logger.warning(
                        "PDFMonkey document creation failed (%d): %s",
                        res.status_code,
                        res.text,
                    )
                    return None

                data = res.json().get("document", {})
                doc_id = data.get("id")

                # If immediately available
                if data.get("download_url"):
                    return str(data["download_url"])

                if not doc_id:
                    return None

                # Poll for asynchronous rendering completion using document_cards
                for _ in range(10):
                    await asyncio.sleep(1.0)
                    poll_res = await client.get(
                        f"{self.base_url}/document_cards/{doc_id}",
                        headers=self.headers,
                    )
                    if poll_res.status_code == 200:
                        card = poll_res.json().get("document_card") or poll_res.json().get("document", {})
                        if card.get("status") == "success" and card.get("download_url"):
                            return str(card["download_url"])
                        if card.get("status") == "failure":
                            logger.error(
                                "PDFMonkey generation failed for doc %s: %s",
                                doc_id,
                                card.get("failure_cause"),
                            )
                            return None

                logger.info("PDFMonkey generation timed out for doc %s", doc_id)
                return None

        except Exception as err:
            logger.warning("Error communicating with PDFMonkey: %s", err)
            return None

    async def fetch_pdf_bytes(self, download_url: str) -> bytes | None:
        """Download raw PDF bytes from a generated download URL."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(download_url)
                if res.status_code == 200:
                    return res.content
                logger.warning("Failed to fetch PDF bytes (%d) from %s", res.status_code, download_url)
                return None
        except Exception as err:
            logger.warning("Error fetching PDF from URL %s: %s", download_url, err)
            return None
