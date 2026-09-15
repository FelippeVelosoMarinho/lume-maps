import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from sqlalchemy.pool import NullPool

from app.config import settings


database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif database_url.startswith("sqlite://"):
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

# Supabase (e a maioria dos Postgres gerenciados) exige SSL
if database_url.startswith("postgresql+asyncpg://") and "ssl=" not in database_url:
    sep = "&" if "?" in database_url else "?"
    database_url = f"{database_url}{sep}ssl=require"

_engine_kwargs: dict = {"echo": False}
if settings.is_serverless or database_url.startswith("postgresql"):
    _engine_kwargs["poolclass"] = NullPool
if database_url.startswith("postgresql+asyncpg://"):
    # Supabase pooler (pgbouncer transaction mode) não suporta prepared statements
    _engine_kwargs["connect_args"] = {"statement_cache_size": 0}

engine = create_async_engine(database_url, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


def _migration_stmts(is_postgres: bool) -> list[str]:
    if is_postgres:
        return [
            "ALTER TABLE markers ADD COLUMN IF NOT EXISTS city VARCHAR(120) DEFAULT ''",
            "ALTER TABLE annotations ADD COLUMN IF NOT EXISTS author_name VARCHAR(120) DEFAULT ''",
            "ALTER TABLE annotations ADD COLUMN IF NOT EXISTS author_username VARCHAR(50) DEFAULT ''",
            "ALTER TABLE annotations ADD COLUMN IF NOT EXISTS author_photo_url VARCHAR(500)",
            "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false",
            "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS map_color VARCHAR(20)",
            "ALTER TABLE markers ADD COLUMN IF NOT EXISTS is_departure BOOLEAN DEFAULT false",
            "ALTER TABLE markers ADD COLUMN IF NOT EXISTS transport VARCHAR(20)",
            "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS is_planning BOOLEAN DEFAULT false",
            "ALTER TABLE journeys ALTER COLUMN subtitle TYPE TEXT",
            "ALTER TABLE passports ADD COLUMN IF NOT EXISTS public_show_journeys BOOLEAN DEFAULT true",
            "ALTER TABLE passports ADD COLUMN IF NOT EXISTS public_show_travels_map BOOLEAN DEFAULT true",
            "ALTER TABLE passports ADD COLUMN IF NOT EXISTS public_show_planning BOOLEAN DEFAULT true",
            "ALTER TABLE passports ADD COLUMN IF NOT EXISTS public_show_stamps BOOLEAN DEFAULT true",
        ]
    return [
        "ALTER TABLE markers ADD COLUMN city VARCHAR(120) DEFAULT ''",
        "ALTER TABLE annotations ADD COLUMN author_name VARCHAR(120) DEFAULT ''",
        "ALTER TABLE annotations ADD COLUMN author_username VARCHAR(50) DEFAULT ''",
        "ALTER TABLE annotations ADD COLUMN author_photo_url VARCHAR(500)",
        "ALTER TABLE attachments ADD COLUMN is_primary BOOLEAN DEFAULT 0",
        "ALTER TABLE journeys ADD COLUMN map_color VARCHAR(20)",
        "ALTER TABLE markers ADD COLUMN is_departure BOOLEAN DEFAULT 0",
        "ALTER TABLE markers ADD COLUMN transport VARCHAR(20)",
        "ALTER TABLE journeys ADD COLUMN is_planning BOOLEAN DEFAULT 0",
        "ALTER TABLE passports ADD COLUMN public_show_journeys BOOLEAN DEFAULT 1",
        "ALTER TABLE passports ADD COLUMN public_show_travels_map BOOLEAN DEFAULT 1",
        "ALTER TABLE passports ADD COLUMN public_show_planning BOOLEAN DEFAULT 1",
        "ALTER TABLE passports ADD COLUMN public_show_stamps BOOLEAN DEFAULT 1",
    ]


async def create_tables():
    is_postgres = database_url.startswith("postgresql")
    async with engine.begin() as conn:
        from app import models  # noqa: F401
        if database_url.startswith("sqlite"):
            await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _migration_stmts(is_postgres):
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
