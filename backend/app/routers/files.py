from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.file_catalog import (
    ALLOWED_EXTENSIONS,
    delete_files,
    get_file_or_404,
    public_file_item,
    read_catalog,
    resolve_upload_path,
    save_upload,
    update_file,
)
from app.services.file_processor import FileProcessor

router = APIRouter(prefix="/files")


class BatchDeleteRequest(BaseModel):
    ids: list[str]


@router.get("")
def list_files():
    return {"files": [public_file_item(file_item) for file_item in read_catalog()]}


@router.get("/meta/allowed-types")
def allowed_types():
    return {"extensions": sorted(ALLOWED_EXTENSIONS)}


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    saved = []
    for file in files:
        saved.append(public_file_item(await save_upload(file)))
    return {"files": saved}


@router.get("/{file_id}")
def get_file(file_id: str):
    return public_file_item(get_file_or_404(file_id))


@router.get("/{file_id}/preview")
def preview_file(file_id: str):
    file_item = get_file_or_404(file_id)
    path = resolve_upload_path(file_item)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored file is missing")

    preview = file_item.get("previewText")
    if not preview:
        ext = Path(file_item["name"]).suffix.lower()
        try:
            if ext in {".txt", ".md"}:
                preview = path.read_text(encoding="utf-8", errors="replace")
            else:
                processor = FileProcessor(chunk_size=2000, chunk_overlap=0)
                chunks, _, _ = processor.process_file(path)
                preview = "\n\n".join(chunks)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Preview generation failed: {exc}") from exc
        preview = preview[:20000]
        update_file(file_id, {"previewText": preview})

    return {"id": file_id, "previewText": preview}


@router.delete("/{file_id}")
def delete_file(file_id: str):
    deleted = delete_files([file_id])
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return {"deleted": deleted}


@router.post("/delete-batch")
def delete_file_batch(request: BatchDeleteRequest):
    deleted = delete_files(request.ids)
    return {"deleted": deleted}
