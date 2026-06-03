import csv
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import config

logger = logging.getLogger(__name__)
router = APIRouter()


class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str


def _escape_newlines(text: str) -> str:
    return text.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")


@router.post("/contact")
async def submit_contact(request: Request, body: ContactRequest):
    timestamp = datetime.now(timezone.utc).isoformat()
    client_host = request.client.host if request.client else ""

    write_header = not config.CONTACT_CSV.exists() or config.CONTACT_CSV.stat().st_size == 0

    try:
        with open(config.CONTACT_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(
                    [
                        "timestamp",
                        "name",
                        "email",
                        "subject",
                        "message",
                        "source_ip",
                    ]
                )
            writer.writerow(
                [
                    timestamp,
                    body.name,
                    body.email,
                    body.subject,
                    _escape_newlines(body.message),
                    client_host,
                ]
            )
    except Exception as e:
        logger.exception("Failed to write contact CSV")
        raise HTTPException(status_code=500, detail=f"Failed to write contact: {e}")

    return {"status": "ok"}
