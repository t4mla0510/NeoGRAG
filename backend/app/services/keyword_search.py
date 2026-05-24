"""Keyword search using BM25 with Vietnamese tokenization."""

import logging
from typing import Optional

from app.schemas import SearchResult
from app.utils.bm25_indexer import BM25Indexer
from app.utils.redis_client import RedisClient

logger = logging.getLogger(__name__)


class KeywordSearch:
    """Keyword/sparse search using BM25 with Vietnamese tokenization.

    Uses LangChain's BM25Retriever with underthesea for Vietnamese NLP.
    Results are cached in Redis.
    """

    _instance: Optional["KeywordSearch"] = None

    def __init__(self):
        self.redis_client = RedisClient.get_instance()

    @classmethod
    def get_instance(cls) -> "KeywordSearch":
        """Get singleton instance of KeywordSearch."""
        if not hasattr(cls, "_instance") or cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_bm25(self) -> BM25Indexer:
        """Get BM25 indexer lazily to ensure indexes are loaded."""
        return BM25Indexer.get_instance()

    def _build_cache_key(self, query: str, collection_name: str, top_k: int) -> str:
        """Build cache key for keyword search."""
        normalized_query = self.redis_client._normalize_query(query)
        query_hash = self.redis_client._hash_key(normalized_query)
        return f"keyword:{query_hash}:{collection_name}:{top_k}"

    def search(
        self,
        query: str,
        collection_name: str,
        top_k: int = 5,
    ) -> list[SearchResult]:
        """Search collection using BM25 keyword matching with Redis caching.

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
            logger.info(f"Keyword cache HIT for query: {query[:50]}...")
            return [SearchResult(**r) for r in cached_result]
        else:
            logger.info(f"Keyword cache MISS for query: {query[:50]}...")

        docs = self.get_bm25().get_relevant_documents(
            query=query,
            k=top_k,
            collection_name=collection_name,
        )

        search_results = []
        for doc in docs:
            search_results.append(
                SearchResult(
                    id=doc.metadata.get(
                        "id",
                        doc.id if hasattr(doc, "id") else str(hash(doc.page_content)),
                    ),
                    document=doc.page_content,
                    metadata=doc.metadata,
                    score=doc.metadata.get("score", 1.0),
                )
            )

        search_results.sort(key=lambda x: x.score, reverse=True)
        logger.debug(f"BM25 search returned {len(search_results)} results")

        self.redis_client.set(
            cache_key,
            [r.__dict__ for r in search_results],
        )

        return search_results
