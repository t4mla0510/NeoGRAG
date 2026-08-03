import logging

import psycopg2
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from contextlib import contextmanager
from app.config import config

logger = logging.getLogger(__name__)

pool = None


def create_database_if_not_exists():
    conn = psycopg2.connect(
        host=config.POSTGRES_HOST,
        port=config.POSTGRES_PORT,
        user=config.POSTGRES_USER,
        password=config.POSTGRES_PASSWORD,
        database="postgres",
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{config.POSTGRES_DB}'")
    exists = cursor.fetchone()
    if not exists:
        cursor.execute(f"CREATE DATABASE {config.POSTGRES_DB}")
        print(f"Database '{config.POSTGRES_DB}' created.")

    cursor.close()
    conn.close()


def init_pool():
    global pool
    if pool is None:
        try:
            create_database_if_not_exists()
            pool = SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                database=config.POSTGRES_DB,
                user=config.POSTGRES_USER,
                password=config.POSTGRES_PASSWORD,
                host=config.POSTGRES_HOST,
                port=config.POSTGRES_PORT,
            )
        except psycopg2.OperationalError as exc:
            # ponytail: Postgres is optional for the admin/display endpoints; auth
            # only. Don't take the whole server down when it's unreachable.
            logger.warning(f"Postgres unavailable, connection pool skipped: {exc}")


def get_pool():
    global pool
    if pool is None:
        init_pool()
    if pool is None:
        raise RuntimeError("Postgres connection pool is not available")
    return pool


@contextmanager
def get_connection():
    p = get_pool()
    conn = p.getconn()
    try:
        yield conn
    finally:
        p.putconn(conn)


@contextmanager
def get_cursor():
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()


def init_db():
    try:
        with get_cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admins (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    username VARCHAR(100) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
    except (psycopg2.OperationalError, RuntimeError) as exc:
        logger.warning(f"Skipping admins table init (Postgres unavailable): {exc}")