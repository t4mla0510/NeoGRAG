from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.config import config
from app.services.file_catalog import (
    get_file_or_404,
    public_file_item,
    read_catalog,
    resolve_upload_path,
    sanitize_filename,
    update_file,
)
from app.services.file_processor import FileProcessor
from app.utils.bm25_indexer import BM25Indexer
from app.utils.chroma_client import ChromaClient

router = APIRouter(prefix="/process")

BuildTarget = Literal["vector", "bm25", "retrieval", "all"]


class MarkdownHeaders(BaseModel):
    enabled: bool = False
    levels: list[int] = Field(default_factory=lambda: [1, 2, 3])
    preserveHierarchy: bool = True


class ProcessingConfig(BaseModel):
    fileId: str
    chunk_size: int
    chunk_overlap: int
    markdown_headers: MarkdownHeaders | None = None
    buildTarget: BuildTarget = "retrieval"

    @model_validator(mode="after")
    def validate_chunking(self):
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be a positive integer")
        if self.chunk_overlap < 0:
            raise ValueError("chunk_overlap must be a non-negative integer")
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class ProcessStartRequest(BaseModel):
    configs: list[ProcessingConfig]


@router.get("/config/{file_id}")
def get_process_config(file_id: str):
    file_item = get_file_or_404(file_id)
    return {
        "fileId": file_item["id"],
        "chunk_size": config.DEFAULT_CHUNK_SIZE,
        "chunk_overlap": config.DEFAULT_CHUNK_OVERLAP,
        "markdown_headers": {
            "enabled": file_item["type"] == "md",
            "levels": [1, 2, 3],
            "preserveHierarchy": True,
        },
        "buildTarget": "retrieval",
    }


@router.post("/start")
def start_processing(request: ProcessStartRequest):
    if not request.configs:
        raise HTTPException(status_code=400, detail="No files selected for processing")

    collection_name = "academic_regulation"
    results = []

    for item_config in request.configs:
        file_item = get_file_or_404(item_config.fileId)
        path = resolve_upload_path(file_item)
        if not path.exists():
            update_file(item_config.fileId, {"status": "failed"})
            raise HTTPException(status_code=404, detail=f"Stored file is missing: {file_item['name']}")

        update_file(item_config.fileId, {"status": "processing"})
        try:
            processor = FileProcessor(
                collection_name=collection_name,
                chunk_size=item_config.chunk_size,
                chunk_overlap=item_config.chunk_overlap,
            )
            markdown_text = processor.extract_markdown_text(path)
            markdown_path = save_processed_markdown(file_item, markdown_text)
            chunks, ids, metadatas = processor.process_text(path, markdown_text)

            if item_config.buildTarget in {"vector", "retrieval", "all"}:
                ChromaClient.get_instance().upsert_documents(
                    collection_name=collection_name,
                    documents=chunks,
                    ids=ids,
                    metadatas=metadatas,
                )

            if item_config.buildTarget in {"bm25", "retrieval", "all"}:
                bm25_indexer = BM25Indexer.get_instance()
                bm25_indexer.load_index(collection_name)
                bm25_indexer.add_documents(
                    texts=chunks,
                    ids=ids,
                    metadatas=metadatas,
                    collection_name=collection_name,
                )
                bm25_indexer.save_index(collection_name)

            try:
                from app.utils.redis_client import RedisClient
                redis_client = RedisClient.get_instance()
                redis_client.invalidate_collection_cache(collection_name)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning(f"Failed to invalidate search cache: {exc}")

            updated = update_file(
                item_config.fileId,
                {
                    "status": "processed",
                    "lastProcessedAt": config_now(),
                    "chunkIds": ids,
                    "processedMarkdownPath": markdown_path,
                    "lastProcessingConfig": item_config.model_dump(),
                },
            )
            results.append(
                {
                    "file": public_file_item(updated),
                    "chunks": len(chunks),
                    "target": item_config.buildTarget,
                }
            )
        except Exception as exc:
            update_file(item_config.fileId, {"status": "failed"})
            results.append({"file": public_file_item(file_item), "error": str(exc), "target": item_config.buildTarget})

    return {"results": results}


@router.get("/status")
def process_status():
    return {"files": [public_file_item(file_item) for file_item in read_catalog()]}


def config_now() -> str:
    from app.services.file_catalog import now_iso

    return now_iso()


def save_processed_markdown(file_item: dict, markdown_text: str) -> str:
    markdown_dir = (config.DATA_DIR / "qchv").resolve()
    markdown_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = sanitize_filename(file_item["name"]).rsplit(".", 1)[0]
    target = (markdown_dir / f"{file_item['id']}_{safe_stem}.md").resolve()
    if markdown_dir not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid processed markdown path")
    target.write_text(markdown_text, encoding="utf-8")
    return str(target)
