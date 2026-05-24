from dataclasses import dataclass


@dataclass
class SearchRequest:
    query: str
    top_k: int = 5


@dataclass
class VectorSearchRequest(SearchRequest):
    pass


@dataclass
class KeywordSearchRequest(SearchRequest):
    pass


@dataclass
class GraphSearchRequest:
    query: str
    hops: int = 2
    top_neighbors: int = 12


@dataclass
class HybridSearchRequest(SearchRequest):
    pass


@dataclass
class SearchResult:
    id: str
    document: str
    metadata: dict
    score: float


@dataclass
class HybridSearchResult:
    id: str
    document: str
    metadata: dict
    semantic_score: float
    keyword_score: float
    combined_score: float


@dataclass
class GraphSearchResult:
    resolved_entities: list[str]
    graph_context: str
    graph_score: float