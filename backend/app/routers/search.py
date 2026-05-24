from fastapi import APIRouter

from app.schemas import (
    GraphSearchRequest,
    GraphSearchResult,
    HybridSearchRequest,
    KeywordSearchRequest,
    VectorSearchRequest,
)
from app.services.graphrag import GraphRAGService
from app.services.hybrid_search import HybridSearch
from app.services.keyword_search import KeywordSearch
from app.services.ned import NEDService
from app.services.semantic_search import SemanticSearch

router = APIRouter()

graphrag_service = GraphRAGService.get_instance()
hybrid_search = HybridSearch.get_instance()
ned_service = NEDService.get_instance()
semantic_search = SemanticSearch.get_instance()
keyword_search = KeywordSearch.get_instance()


@router.post("/search/vector")
async def search_vector(request: VectorSearchRequest):
    results = semantic_search.search(
        query=request.query,
        collection_name="academic_regulation",
        top_k=request.top_k,
    )
    return {
        "query": request.query,
        "results": [
            {"id": r.id, "document": r.document, "metadata": r.metadata, "score": r.score}
            for r in results
        ],
    }


@router.post("/search/keyword")
async def search_keyword(request: KeywordSearchRequest):
    results = keyword_search.search(
        query=request.query,
        collection_name="academic_regulation",
        top_k=request.top_k,
    )
    return {
        "query": request.query,
        "results": [
            {"id": r.id, "document": r.document, "metadata": r.metadata, "score": r.score}
            for r in results
        ],
    }


@router.post("/search/graph")
async def search_graph(request: GraphSearchRequest):
    if not graphrag_service.is_available():
        return GraphSearchResult(
            resolved_entities=[],
            graph_context="",
            graph_score=0.0,
        )

    bundle = graphrag_service.build_query_bundle(
        query=request.query,
        enhanced_query=None,
    )
    return GraphSearchResult(
        resolved_entities=bundle.resolved_entities,
        graph_context=bundle.graph_context_text,
        graph_score=bundle.graph_score,
    )


@router.post("/search/hybrid")
async def search_hybrid(request: HybridSearchRequest):
    enhanced_query = ned_service.enhance_query(request.query)

    results = hybrid_search.search(
        query=enhanced_query,
        collection_name="academic_regulation",
        top_k=request.top_k,
    )

    return {
        "query": request.query,
        "enhanced_query": enhanced_query,
        "results": [
            {
                "id": r.id,
                "document": r.document,
                "metadata": r.metadata,
                "semantic_score": r.semantic_score,
                "keyword_score": r.keyword_score,
                "combined_score": r.combined_score,
            }
            for r in results
        ],
    }