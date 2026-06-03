import csv
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import config

logger = logging.getLogger(__name__)
router = APIRouter()


class FeedbackRequest(BaseModel):
    message_id: str
    rating: int
    user_query: str = ""
    bot_response: str = ""
    session_id: str = ""


def _escape_newlines(text: str) -> str:
    return text.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    timestamp = datetime.now(timezone.utc).isoformat()
    model_name = config.LLM_MODEL_NAME

    write_header = not config.FEEDBACK_CSV.exists() or config.FEEDBACK_CSV.stat().st_size == 0

    try:
        with open(config.FEEDBACK_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(
                    [
                        "timestamp",
                        "message_id",
                        "session_id",
                        "rating",
                        "user_query",
                        "bot_response",
                        "model",
                    ]
                )
            writer.writerow(
                [
                    timestamp,
                    request.message_id,
                    request.session_id,
                    request.rating,
                    _escape_newlines(request.user_query),
                    _escape_newlines(request.bot_response),
                    model_name,
                ]
            )
    except Exception as e:
        logger.exception("Failed to write feedback CSV")
        raise HTTPException(status_code=500, detail=f"Failed to write feedback: {e}")

    return {"status": "ok"}
