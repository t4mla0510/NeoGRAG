from dataclasses import dataclass

from pydantic import BaseModel


class AdminRegister(BaseModel):
    email: str
    password: str
    username: str


class AdminLogin(BaseModel):
    email: str
    password: str


class AdminResponse(BaseModel):
    id: int
    email: str
    username: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
