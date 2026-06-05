from app.routers.auth import router as auth_router
from app.routers.contact import router as contact_router
from app.routers.feedback import router as feedback_router
from app.routers.search import router as search_router

__all__ = ["auth_router", "contact_router", "feedback_router", "search_router"]