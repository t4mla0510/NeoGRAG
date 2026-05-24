from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from app.config import config

router = APIRouter(prefix="/knowledge-graph")

GRAPH_FILE_NAME = "academic_regulation.graph.html"
NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


def graph_file_path():
    path = (config.GRAPHRAG_DIR / GRAPH_FILE_NAME).resolve()
    graph_dir = config.GRAPHRAG_DIR.resolve()
    if graph_dir not in path.parents:
        raise HTTPException(status_code=400, detail="Invalid graph path")
    return path


@router.get("/academic-regulation")
def academic_regulation_graph():
    path = graph_file_path()
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Knowledge graph HTML is not available")
    return FileResponse(path, media_type="text/html", headers=NO_CACHE_HEADERS)


@router.head("/academic-regulation")
def academic_regulation_graph_head():
    path = graph_file_path()
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Knowledge graph HTML is not available")
    return Response(status_code=200, media_type="text/html", headers=NO_CACHE_HEADERS)


@router.get("/status")
def knowledge_graph_status():
    path = graph_file_path()
    return {
        "available": path.exists() and path.is_file(),
        "path": str(path),
        "updatedAt": path.stat().st_mtime if path.exists() else None,
        "url": "/api/knowledge-graph/academic-regulation",
    }
