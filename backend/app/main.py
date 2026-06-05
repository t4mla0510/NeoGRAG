"""FastAPI entry point for CTU AI Context Search API."""

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.utils.bm25_indexer import BM25Indexer
from app.routers import files, knowledge_graph, process
from app.routers import auth_router, contact_router, feedback_router, search_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CTU AI Context Search API...")
    config.BM25_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    bm25_indexer = BM25Indexer.get_instance()
    bm25_indexer.load_index("academic_regulation")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="CTU AI Context Search API",
    description="Academic regulation search with GraphRAG",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(process.router, prefix="/api", tags=["process"])
app.include_router(knowledge_graph.router, prefix="/api", tags=["knowledge-graph"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(feedback_router, prefix="/api", tags=["feedback"])
app.include_router(contact_router, prefix="/api", tags=["contact"])
app.include_router(search_router, tags=["search"])


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def root():
    return """
    <html>
        <head>
            <title>CTU Context Search</title>
            <style>
                body { font-family: Arial; padding: 32px; background: #fafafa; }
                .box {
                    max-width: 600px; margin: auto; padding: 24px;
                    background: white; border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                h1 { color: #4B7BEC; }
                p { color: #555; font-size: 16px; }
                a { color: #20bf6b; font-weight: bold; text-decoration: none; }
                .endpoint { margin: 8px 0; padding: 8px; background: #f0f0f0; border-radius: 8px; }
                code { background: #e8e8e8; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>CTU AI Context Search API</h1>
                <p>Your backend is running successfully</p>

                <p>Available endpoints:</p>
                <div class="endpoint"><code>POST /search/graph</code> - Knowledge graph lookup</div>
                <div class="endpoint"><code>POST /search/hybrid</code> - BM25 + vector + LLM rerank</div>

                <p>Explore API docs:</p>
                <ul>
                    <li><a href="/docs">Swagger UI</a></li>
                    <li><a href="/redoc">ReDoc UI</a></li>
                </ul>
            </div>
        </body>
    </html>
    """


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
