from fastapi import APIRouter, HTTPException

from app.schemas import AdminLogin, AdminRegister, AdminResponse, TokenResponse
from app.services.auth import (
    authenticate_admin,
    create_admin,
    decode_token,
    get_admin_by_id,
    get_admin_by_email,
)

router = APIRouter()


def get_current_admin(authorization: str = None):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return None
    admin_id = int(payload.get("sub"))
    return get_admin_by_id(admin_id)


@router.post("/auth/register", response_model=AdminResponse)
async def register(admin: AdminRegister):
    existing = get_admin_by_email(admin.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    created = create_admin(admin.email, admin.password, admin.username)
    return AdminResponse(id=created["id"], email=created["email"], username=created["username"])


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: AdminLogin):
    admin = authenticate_admin(credentials.email, credentials.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return TokenResponse(access_token=admin["access_token"])


@router.get("/auth/me", response_model=AdminResponse)
async def get_me(authorization: str = None):
    admin = get_current_admin(authorization)
    if not admin:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return AdminResponse(id=admin["id"], email=admin["email"], username=admin["username"])