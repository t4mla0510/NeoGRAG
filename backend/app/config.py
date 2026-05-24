import os
from pathlib import Path

from dotenv import load_dotenv

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent

project_root_env = PROJECT_ROOT / ".env"
load_dotenv(project_root_env if project_root_env.exists() else None, override=True)


class Config:
    LLM_API_KEY: str = os.environ.get("OLLAMA_API_KEY", "")
    LLM_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    LLM_MODEL_NAME: str = os.environ.get("OLLAMA_MODEL", "ministral-3:14b-cloud")

    EMBEDDING_MODEL_NAME: str = os.environ.get("EMBEDDING_MODEL_NAME", "Qwen/Qwen3-Embedding-0.6B")

    HYBRID_SEARCH_MULTIPLIER: int = int(os.environ.get("HYBRID_SEARCH_MULTIPLIER", "100"))
    LLM_RERANK_MULTIPLIER: int = int(os.environ.get("LLM_RERANK_MULTIPLIER", "2"))

    REDIS_HOST: str = os.environ.get("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.environ.get("REDIS_PORT", "6379"))
    REDIS_TTL: int = int(os.environ.get("REDIS_TTL", "3600"))

    CHROMA_HNSW_SPACE: str = os.environ.get("CHROMA_HNSW_SPACE", "cosine")
    CHROMA_EF_CONSTRUCTION: int = int(os.environ.get("CHROMA_EF_CONSTRUCTION", "200"))
    CHROMA_EF_SEARCH: int = int(os.environ.get("CHROMA_EF_SEARCH", "100"))
    CHROMA_MAX_NEIGHBORS: int = int(os.environ.get("CHROMA_MAX_NEIGHBORS", "32"))

    DEFAULT_CHUNK_SIZE: int = 500
    DEFAULT_CHUNK_OVERLAP: int = 50

    DATA_DIR: Path = PROJECT_ROOT / "data"

    BM25_CACHE_DIR: Path = PROJECT_ROOT / "cache"
    BM25_SKIP_COLLECTIONS: list[str] = ["faq"]
    
    GRAPHRAG_DIR: Path = DATA_DIR / "graphify-out"
    GRAPHRAG_CACHE_DIR: Path = DATA_DIR / "graphify-out" / "cache"
    GRAPHRAG_GRAPH_NAME: str = "academic_regulation"
    GRAPHRAG_CONTEXT_HOPS: int = int(os.environ.get("GRAPHRAG_CONTEXT_HOPS", "2"))
    GRAPHRAG_TOP_NEIGHBORS: int = int(os.environ.get("GRAPHRAG_TOP_NEIGHBORS", "12"))

config = Config()
