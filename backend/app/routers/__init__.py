from app.routers.auth import router as auth_router
from app.routers.search import router as search_router
from app.routers.upload import router as upload_router

__all__ = ["auth_router", "search_router", "upload_router"]