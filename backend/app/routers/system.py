"""Read-only system info and health endpoints for the admin dashboard."""

import logging
import time
from pathlib import Path

from fastapi import APIRouter

from app.config import PROJECT_ROOT, config
from app.utils.bm25_indexer import BM25Indexer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system")

SYSTEM_VERSION = "2.0.0"
GRAPH_FILE_NAME = "academic_regulation.graph.html"


@router.get("/info")
def system_info():
    return {
        "version": SYSTEM_VERSION,
        "llm_model": config.LLM_MODEL_NAME,
        "embedding_model": config.EMBEDDING_MODEL_NAME,
        "collection": config.GRAPHRAG_GRAPH_NAME,
        "chunk_size": config.DEFAULT_CHUNK_SIZE,
        "chunk_overlap": config.DEFAULT_CHUNK_OVERLAP,
        "hnsw_space": config.CHROMA_HNSW_SPACE,
    }


@router.get("/health")
def system_health():
    return {
        "redis": _redis_health(),
        "chroma": _chroma_health(),
        "bm25": _bm25_health(),
        "kg": _kg_health(),
    }


def _redis_health() -> dict:
    try:
        from app.utils.redis_client import RedisClient

        client = RedisClient.get_instance().client
        started = time.perf_counter()
        client.ping()
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        return {"connected": True, "latency_ms": latency_ms}
    except Exception as exc:
        logger.warning(f"Redis health check failed: {exc}")
        return {"connected": False, "latency_ms": None}


def _chroma_health() -> dict:
    try:
        import chromadb

        path = str((PROJECT_ROOT / "chroma_data").resolve())
        client = chromadb.PersistentClient(path=path)
        collections = [
            {"name": col.name, "count": col.count()} for col in client.list_collections()
        ]
        vector_count = sum(col["count"] for col in collections)
        return {"collections": collections, "vector_count": vector_count}
    except Exception as exc:
        logger.warning(f"ChromaDB health check failed: {exc}")
        return {"collections": [], "vector_count": 0, "error": str(exc)}


def _bm25_health() -> dict:
    try:
        indexer = BM25Indexer.get_instance()
        count = indexer.document_count(config.GRAPHRAG_GRAPH_NAME)
        return {"loaded": count > 0, "document_count": count}
    except Exception as exc:
        logger.warning(f"BM25 health check failed: {exc}")
        return {"loaded": False, "document_count": 0, "error": str(exc)}


def _kg_health() -> dict:
    try:
        path = (config.GRAPHRAG_DIR / GRAPH_FILE_NAME).resolve()
        return {
            "available": path.exists() and path.is_file(),
            "updated_at": path.stat().st_mtime if path.exists() else None,
        }
    except Exception as exc:
        logger.warning(f"KG health check failed: {exc}")
        return {"available": False, "updated_at": None}
