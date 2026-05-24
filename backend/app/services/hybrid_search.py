"""Hybrid search combining BM25 keyword search with ChromaDB semantic search."""

import re
import json
import logging
from typing import Optional

from concurrent.futures import ThreadPoolExecutor

from app.config import config
from app.schemas import HybridSearchResult
from app.services.keyword_search import KeywordSearch
from app.services.semantic_search import SemanticSearch
from app.utils.llm_client import LLMClient
from app.utils.redis_client import RedisClient

logger = logging.getLogger(__name__)

RRF_K = 60


class HybridSearch:
    """Hybrid search combining BM25 keyword and ChromaDB semantic search.

    Uses Min-Max normalization followed by Reciprocal Rank Fusion (RRF)
    to combine results from both search methods. Results are cached in Redis.
    """

    _instance: Optional["HybridSearch"] = None

    def __init__(self):
        self.redis_client = RedisClient.get_instance()

    @classmethod
    def get_instance(cls) -> "HybridSearch":
        """Get singleton instance of HybridSearch."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_semantic(self) -> SemanticSearch:
        """Get semantic search lazily."""
        return SemanticSearch.get_instance()

    def get_keyword(self) -> KeywordSearch:
        """Get keyword search lazily."""
        return KeywordSearch.get_instance()

    def get_llm(self) -> LLMClient:
        """Get LLM client lazily."""
        return LLMClient()

    def rerank_with_llm(
        self,
        query: str,
        results: list["HybridSearchResult"],
    ) -> list["HybridSearchResult"]:
        """Rerank results using LLM judgment."""
        if len(results) <= 1:
            return results

        doc_ids_hash = self.redis_client._hash_key(
            ",".join(sorted([r.id for r in results]))
        )
        normalized_query = self.redis_client._normalize_query(query)
        rerank_cache_key = f"rerank:{self.redis_client._hash_key(normalized_query)}:{doc_ids_hash}"

        cached_rerank = self.redis_client.get(rerank_cache_key)
        if cached_rerank:
            logger.debug("Rerank cache hit")
            return [HybridSearchResult(**r) for r in cached_rerank]

        llm = self.get_llm()

        docs_text = "\n\n".join(
            f"[{i}] {r.document[:500]}" for i, r in enumerate(results)
        )

        prompt = f"""Given the search query: "{query}"

Rank the following documents by relevance to this query. Consider both semantic meaning and keyword matching. Return the document indices in order of relevance, most relevant first.

Documents:
{docs_text}

Return ONLY a JSON array of indices (e.g., [2, 0, 1, 3]), ordered from most relevant to least relevant. Include all indices."""

        try:
            response = llm.generate(prompt)

            match = re.search(r"\[.*\]", response)
            if match:
                rankings = json.loads(match.group())
                if isinstance(rankings, list) and all(
                    isinstance(i, int) for i in rankings
                ):
                    reranked = [results[i] for i in rankings if 0 <= i < len(results)]
                    missing = [r for r in results if r not in reranked]
                    final_rerank = reranked + missing

                    self.redis_client.set(
                        rerank_cache_key,
                        [r.__dict__ for r in final_rerank],
                    )
                    return final_rerank
        except Exception as e:
            logger.warning(f"LLM reranking failed: {e}")

        return results

    def search(
        self,
        query: str,
        collection_name: str,
        top_k: int = 5,
    ) -> list[HybridSearchResult]:
        """Search using hybrid BM25 + ChromaDB fusion with Redis caching."""
        cache_key = self.redis_client.build_search_cache_key(
            query=query,
            collection_name=collection_name,
            top_k=top_k,
            multiplier=config.LLM_RERANK_MULTIPLIER,
        )

        cached_result = self.redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Search cache HIT for query: {query[:50]}...")
            return [HybridSearchResult(**r) for r in cached_result]
        else:
            logger.info(f"Search cache MISS for query: {query[:50]}...")

        top_k_scaled = top_k * config.HYBRID_SEARCH_MULTIPLIER

        with ThreadPoolExecutor(max_workers=2) as executor:
            sem_future = executor.submit(
                self.get_semantic().search,
                query,
                collection_name,
                top_k_scaled,
            )
            kw_future = executor.submit(
                self.get_keyword().search,
                query,
                collection_name,
                top_k_scaled,
            )
            semantic_results = sem_future.result()
            keyword_results = kw_future.result()

        if not semantic_results and not keyword_results:
            return []

        semantic_scores = {r.id: r.score for r in semantic_results}
        keyword_scores = {r.id: r.score for r in keyword_results}

        all_doc_ids = set(semantic_scores.keys()) | set(keyword_scores.keys())

        normalized_semantic = min_max_normalize(semantic_scores)
        normalized_keyword = min_max_normalize(keyword_scores)

        rrf_input: dict[str, list[tuple[str, float]]] = {}
        for doc_id in all_doc_ids:
            sources = []
            if doc_id in normalized_semantic:
                sources.append(("semantic", normalized_semantic[doc_id]))
            if doc_id in normalized_keyword:
                sources.append(("keyword", normalized_keyword[doc_id]))
            rrf_input[doc_id] = sources

        rrf_scores = reciprocal_rank_fusion(rrf_input)

        doc_lookup: dict[str, tuple[str, dict]] = {}
        for r in semantic_results:
            doc_lookup[r.id] = (r.document, r.metadata)
        for r in keyword_results:
            if r.id not in doc_lookup:
                doc_lookup[r.id] = (r.document, r.metadata)

        hybrid_results = []
        for doc_id, combined_score in rrf_scores.items():
            document, metadata = doc_lookup.get(doc_id, ("", {}))
            sem_score = normalized_semantic.get(doc_id, 0.0)
            kw_score = normalized_keyword.get(doc_id, 0.0)

            hybrid_results.append(
                HybridSearchResult(
                    id=doc_id,
                    document=document,
                    metadata=metadata,
                    semantic_score=sem_score,
                    keyword_score=kw_score,
                    combined_score=combined_score,
                )
            )

        hybrid_results.sort(key=lambda x: x.combined_score, reverse=True)
        logger.debug(f"Hybrid search returned {len(hybrid_results)} results")

        candidate_results = hybrid_results[: top_k * config.LLM_RERANK_MULTIPLIER]
        reranked = self.rerank_with_llm(query, candidate_results)
        final_result = reranked[:top_k]

        self.redis_client.set(
            cache_key,
            [r.__dict__ for r in final_result],
        )

        return final_result


def min_max_normalize(scores: dict[str, float]) -> dict[str, float]:
    """Normalize scores to [0, 1] range using min-max normalization."""
    if not scores:
        return {}

    values = list(scores.values())
    min_val = min(values)
    max_val = max(values)

    if max_val == min_val:
        return {doc_id: 1.0 for doc_id in scores}

    return {
        doc_id: (val - min_val) / (max_val - min_val) for doc_id, val in scores.items()
    }


def reciprocal_rank_fusion(
    results_by_doc: dict[str, list[tuple[str, float]]],
    k: int = RRF_K,
) -> dict[str, float]:
    """Combine multiple result lists using Reciprocal Rank Fusion."""
    rrf_scores: dict[str, float] = {}

    for doc_id, source_scores in results_by_doc.items():
        rrf_scores[doc_id] = sum(
            1 / (k + rank) for rank, (_, _) in enumerate(source_scores)
        )

    return rrf_scores