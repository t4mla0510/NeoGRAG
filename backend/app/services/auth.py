from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import config
from app.utils.postgres_client import get_cursor, init_db

init_db()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_token(admin_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=config.JWT_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(admin_id),
        "email": email,
        "exp": expire,
    }
    return jwt.encode(to_encode, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_admin_by_email(email: str) -> Optional[dict]:
    with get_cursor() as cursor:
        cursor.execute(
            "SELECT id, email, username, password_hash, created_at FROM admins WHERE email = %s",
            (email,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "password_hash": row[3],
                "created_at": row[4],
            }
        return None


def get_admin_by_id(admin_id: int) -> Optional[dict]:
    with get_cursor() as cursor:
        cursor.execute(
            "SELECT id, email, username, created_at FROM admins WHERE id = %s",
            (admin_id,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "created_at": row[3],
            }
        return None


def create_admin(email: str, password: str, username: str) -> dict:
    password_hash = hash_password(password)
    with get_cursor() as cursor:
        cursor.execute(
            "INSERT INTO admins (email, username, password_hash) VALUES (%s, %s, %s) RETURNING id, email, username, created_at",
            (email, username, password_hash),
        )
        row = cursor.fetchone()
        return {
            "id": row[0],
            "email": row[1],
            "username": row[2],
            "created_at": row[3],
        }


def authenticate_admin(email: str, password: str) -> Optional[dict]:
    admin = get_admin_by_email(email)
    if not admin:
        return None
    if not verify_password(password, admin["password_hash"]):
        return None
    token = create_token(admin["id"], admin["email"])
    return {
        "id": admin["id"],
        "email": admin["email"],
        "username": admin["username"],
        "access_token": token,
    }