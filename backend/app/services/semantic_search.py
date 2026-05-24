"""Semantic search using ChromaDB vector search."""

import logging
from typing import Optional

from app.schemas import SearchResult
from app.utils.chroma_client import ChromaClient
from app.utils.redis_client import RedisClient

logger = logging.getLogger(__name__)


class SemanticSearch:
    """Semantic/dense search using ChromaDB.

    Uses ChromaDB's vector search for semantic similarity matching.
    Results are cached in Redis.
    """

    _instance: Optional["SemanticSearch"] = None

    def __init__(self):
        self.chroma_client = ChromaClient.get_instance()
        self.redis_client = RedisClient.get_instance()

    @classmethod
    def get_instance(cls) -> "SemanticSearch":
        """Get singleton instance of SemanticSearch."""
        if not hasattr(cls, "_instance") or cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _build_cache_key(self, query: str, collection_name: str, top_k: int) -> str:
        """Build cache key for semantic search."""
        normalized_query = self.redis_client._normalize_query(query)
        query_hash = self.redis_client._hash_key(normalized_query)
        return f"semantic:{query_hash}:{collection_name}:{top_k}"

    def search(
        self,
        query: str,
        collection_name: str,
        top_k: int = 5,
    ) -> list[SearchResult]:
        """Search collection using semantic vector search with Redis caching.

        Args:
            query: Search query text.
            collection_name: Name of the collection to search.
            top_k: Number of results to return.

        Returns:
            List of SearchResult objects sorted by relevance (highest first).
        """
        cache_key = self._build_cache_key(query, collection_name, top_k)

        cached_result = self.redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Semantic cache HIT for query: {query[:50]}...")
            return [SearchResult(**r) for r in cached_result]
        else:
            logger.info(f"Semantic cache MISS for query: {query[:50]}...")

        try:
            results = self.chroma_client.query(
                collection_name=collection_name,
                query_text=query,
                top_k=top_k,
            )
        except Exception as e:
            logger.error(f"ChromaDB query failed: {e}")
            return []

        search_results = []
        if not results or not results.get("documents"):
            return []

        documents = results["documents"][0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        for i, doc in enumerate(documents):
            distance = distances[i] if i < len(distances) else 0.0
            score = 1.0 - distance
            search_results.append(
                SearchResult(
                    id=ids[i] if i < len(ids) else f"doc_{i}",
                    document=doc,
                    metadata=metadatas[i] if metadatas and i < len(metadatas) else {},
                    score=score,
                )
            )

        search_results.sort(key=lambda x: x.score, reverse=True)
        logger.debug(f"Semantic search returned {len(search_results)} results")

        self.redis_client.set(
            cache_key,
            [r.__dict__ for r in search_results],
        )

        return search_results
