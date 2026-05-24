import json
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.config import config

ALLOWED_EXTENSIONS = {".docx", ".pdf", ".txt", ".md"}
UPLOAD_DIR = config.DATA_DIR / "uploads"
CATALOG_PATH = UPLOAD_DIR / "files.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def file_type_from_name(filename: str) -> str:
    return normalize_extension(filename).lstrip(".")


def sanitize_filename(filename: str) -> str:
    safe = Path(filename or "upload").name
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", safe).strip("._")
    return safe or "upload"


def ensure_storage() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if not CATALOG_PATH.exists():
        CATALOG_PATH.write_text("[]", encoding="utf-8")


def read_catalog() -> list[dict[str, Any]]:
    ensure_storage()
    try:
        data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = []
    return data if isinstance(data, list) else []


def write_catalog(files: list[dict[str, Any]]) -> None:
    ensure_storage()
    CATALOG_PATH.write_text(json.dumps(files, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_upload_path(file_item: dict[str, Any]) -> Path:
    stored_name = file_item.get("storedName")
    if not stored_name:
        raise HTTPException(status_code=404, detail="Stored file path is missing")

    path = (UPLOAD_DIR / stored_name).resolve()
    if UPLOAD_DIR.resolve() not in path.parents and path != UPLOAD_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid stored file path")
    return path


def public_file_item(file_item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in file_item.items() if key != "storedName"}


async def save_upload(file: UploadFile) -> dict[str, Any]:
    ext = normalize_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}. Supported: {allowed}")

    ensure_storage()
    original_name = sanitize_filename(file.filename or f"upload{ext}")
    file_id = uuid.uuid4().hex
    stored_name = f"{file_id}_{original_name}"
    target_path = (UPLOAD_DIR / stored_name).resolve()

    if UPLOAD_DIR.resolve() not in target_path.parents:
        raise HTTPException(status_code=400, detail="Invalid upload path")

    with target_path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)

    file_item = {
        "id": file_id,
        "name": original_name,
        "type": file_type_from_name(original_name),
        "size": target_path.stat().st_size,
        "uploadedAt": now_iso(),
        "status": "uploaded",
        "lastProcessedAt": None,
        "previewText": None,
        "storedName": stored_name,
        "chunkIds": [],
    }
    files = read_catalog()
    files.append(file_item)
    write_catalog(files)
    return file_item


def get_file_or_404(file_id: str) -> dict[str, Any]:
    for file_item in read_catalog():
        if file_item.get("id") == file_id:
            return file_item
    raise HTTPException(status_code=404, detail="File not found")


def update_file(file_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    files = read_catalog()
    for index, file_item in enumerate(files):
        if file_item.get("id") == file_id:
            updated = {**file_item, **updates}
            files[index] = updated
            write_catalog(files)
            return updated
    raise HTTPException(status_code=404, detail="File not found")


def delete_files(file_ids: list[str]) -> list[str]:
    ids = set(file_ids)
    files = read_catalog()
    kept = []
    deleted = []
    for file_item in files:
        if file_item.get("id") in ids:
            path = resolve_upload_path(file_item)
            if path.exists():
                path.unlink()
            deleted.append(file_item["id"])
        else:
            kept.append(file_item)
    write_catalog(kept)
    return deleted
