"""Redis client for caching search results."""

import json
import hashlib
import logging
import unicodedata
from typing import Optional

import redis

from app.config import config

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper for search result caching."""

    _instance: Optional["RedisClient"] = None

    def __init__(self):
        self.client = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=0,
            decode_responses=True,
        )
        logger.info(f"Redis client initialized: {config.REDIS_HOST}:{config.REDIS_PORT}")

    @classmethod
    def get_instance(cls) -> "RedisClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _normalize_query(self, query: str) -> str:
        """Normalize query for consistent cache key."""
        query = query.strip().lower()
        query = unicodedata.normalize("NFC", query)
        query = " ".join(query.split())
        return query

    def _hash_key(self, data: str) -> str:
        """Generate hash key from string data."""
        return hashlib.sha256(data.encode()).hexdigest()

    def get(self, key: str) -> Optional[dict]:
        """Get cached value by key."""
        try:
            data = self.client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis GET failed: {e}")
        return None

    def set(self, key: str, value: dict, ttl: int = None) -> bool:
        """Set cached value with optional TTL."""
        try:
            ttl = ttl or config.REDIS_TTL
            self.client.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.warning(f"Redis SET failed: {e}")
        return False

    def delete(self, key: str) -> bool:
        """Delete cached key."""
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis DELETE failed: {e}")
        return False

    def build_search_cache_key(
        self,
        query: str,
        collection_name: str,
        top_k: int,
        multiplier: int,
    ) -> str:
        """Build cache key for hybrid search results."""
        normalized_query = self._normalize_query(query)
        query_hash = self._hash_key(normalized_query)
        return f"search:{query_hash}:{collection_name}:{top_k}:{multiplier}"

    def invalidate_collection_cache(self, collection_name: str) -> bool:
        """Delete all cached search / rerank keys for a collection.

        Should be called after ingesting or updating documents
        so that subsequent queries reflect the new data.
        """
        try:
            patterns = [
                f"search:*:{collection_name}:*",
                f"semantic:*:{collection_name}:*",
                f"keyword:*:{collection_name}:*",
                f"rerank:*",
            ]
            count = 0
            for pattern in patterns:
                for key in self.client.scan_iter(match=pattern):
                    self.client.delete(key)
                    count += 1
            logger.info(
                f"Invalidated {count} cache keys for collection '{collection_name}'"
            )
            return True
        except Exception as e:
            logger.warning(f"Cache invalidation failed for '{collection_name}': {e}")
            return False