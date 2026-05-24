"""Runtime GraphRAG service for query expansion and graph-aware reranking."""

from __future__ import annotations

import logging
import pickle
import re
from dataclasses import dataclass

import networkx as nx

GraphT = nx.MultiDiGraph

from app.config import config
from app.schemas import HybridSearchResult
from app.services.ned import NEDService

logger = logging.getLogger(__name__)


@dataclass
class GraphQueryBundle:
    resolved_entities: list[str]
    graph_context_text: str
    graph_score: float


class GraphRAGService:
    """Query-time graph utility layer."""

    @classmethod
    def get_instance(cls) -> "GraphRAGService":
        if not hasattr(cls, "_instance") or cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self) -> None:
        self.ned = NEDService.get_instance()
        self.graph_path = config.GRAPHRAG_DIR / f"{config.GRAPHRAG_GRAPH_NAME}.gpickle"
        self._graph: GraphT | None = None
        self._node_index: dict[str, list[str]] = {}

    def _build_index(self, graph: GraphT) -> None:
        self._node_index = {}
        for node, attrs in graph.nodes(data=True):
            label = str(attrs.get("label", node)).lower()
            self._node_index.setdefault(label, []).append(node)
            if node != label:
                self._node_index.setdefault(node, []).append(node)

    def is_available(self) -> bool:
        return nx is not None and self.graph_path.exists()

    def _load_graph(self) -> GraphT | None:
        if self._graph is not None:
            return self._graph
        if nx is None:
            return None
        if not self.graph_path.exists():
            return None
        try:
            with open(self.graph_path, "rb") as handle:
                self._graph = pickle.load(handle)
            self._build_index(self._graph)
            return self._graph
        except Exception as exc:
            logger.warning("Failed to load GraphRAG graph: %s", exc)
            return None

    def build_query_bundle(self, query: str, enhanced_query: str | None = None) -> GraphQueryBundle:
        graph = self._load_graph()
        if graph is None:
            return GraphQueryBundle([], "", 0.0)

        base_query = enhanced_query or query
        resolved_entities = self.lookup_entities(base_query, graph)
        context_text, rel_score = self.expand_context(resolved_entities, graph)
        return GraphQueryBundle(resolved_entities, context_text, rel_score)

    def lookup_entities(self, query: str, graph: GraphT) -> list[str]:
        query_l = query.lower()
        seeds: list[str] = []

        matched = self.ned._match_entities(query)
        for item in matched:
            key = self._canonicalize(item.entity)
            if key in graph:
                seeds.append(key)

        for label, nodes in self._node_index.items():
            if label in query_l:
                for node in nodes:
                    if node not in seeds:
                        seeds.append(node)

        seen = set()
        dedup = []
        for s in seeds:
            if s not in seen:
                seen.add(s)
                dedup.append(s)
        return dedup[:10]

    def expand_context(
        self,
        seed_entities: list[str],
        graph: GraphT,
        hops: int | None = None,
    ) -> tuple[str, float]:
        if not seed_entities:
            return "", 0.0
        hops = hops or config.GRAPHRAG_CONTEXT_HOPS

        lines = []
        confidence_acc = 0.0
        edges_count = 0
        visited = set(seed_entities)

        for seed in seed_entities:
            frontier = {seed}
            for _ in range(hops):
                next_frontier = set()
                for node in frontier:
                    neighbors = list(graph.successors(node)) + list(
                        graph.predecessors(node)
                    )
                    for nb in neighbors[: config.GRAPHRAG_TOP_NEIGHBORS]:
                        if nb not in visited:
                            visited.add(nb)
                        edge_payloads = []
                        edge_payloads.extend(list(graph.get_edge_data(node, nb, default={}).values()))
                        edge_payloads.extend(list(graph.get_edge_data(nb, node, default={}).values()))
                        for edge_data in edge_payloads:
                            relation = edge_data.get("relation", "related_to")
                            confidence = float(edge_data.get("confidence", 0.0))
                            src_label = graph.nodes.get(node, {}).get("label", node)
                            dst_label = graph.nodes.get(nb, {}).get("label", nb)
                            lines.append(f"{src_label} --{relation}--> {dst_label}")
                            confidence_acc += confidence
                            edges_count += 1
                        next_frontier.add(nb)
                frontier = next_frontier

        graph_score = (confidence_acc / edges_count) if edges_count else 0.0
        context = "\n".join(lines[:40])
        return context, graph_score

    def rerank_results(
        self,
        results: list[HybridSearchResult],
        resolved_entities: list[str],
        graph_context_text: str,
    ) -> list[HybridSearchResult]:
        if not results:
            return results

        context_terms = set(
            t for t in re.findall(r"\w+", graph_context_text.lower()) if len(t) >= 3
        )
        entity_terms = set(resolved_entities)
        if not context_terms and not entity_terms:
            return results

        rescored = []
        for item in results:
            text = f"{item.document} {item.metadata}".lower()
            entity_hits = sum(1 for ent in entity_terms if ent and ent in text)
            context_hits = sum(1 for token in context_terms if token in text)
            graph_relevance = min(1.0, 0.15 * entity_hits + 0.01 * context_hits)
            item.combined_score = item.combined_score + graph_relevance
            rescored.append(item)

        rescored.sort(key=lambda x: x.combined_score, reverse=True)
        return rescored

    @staticmethod
    def _canonicalize(value: str) -> str:
        return re.sub(r"\s+", " ", value.strip().lower())
