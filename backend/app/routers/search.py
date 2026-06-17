from fastapi import APIRouter

from app.schemas import (
    GraphSearchRequest,
    GraphSearchResult,
    HybridSearchRequest,
)
from app.services.graphrag import GraphRAGService
from app.services.hybrid_search import HybridSearch
from app.services.ned import NEDService

router = APIRouter()

graphrag_service = GraphRAGService.get_instance()
hybrid_search = HybridSearch.get_instance()
ned_service = NEDService.get_instance()


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
    enhancement = ned_service.enhance(request.query)

    # Use the protected search query for retrieval; the LLM context is kept
    # separate and can be prepended to the generation prompt by the caller.
    results = hybrid_search.search(
        query=enhancement.search_query,
        collection_name="academic_regulation",
        top_k=request.top_k,
    )

    return {
        "query": request.query,
        "search_query": enhancement.search_query,
        "llm_context": enhancement.llm_context,
        "enhanced_query": enhancement.combined,
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