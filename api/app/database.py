from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings


database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif database_url.startswith("sqlite://"):
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

engine = create_async_engine(database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        from app import models  # noqa: F401
        if database_url.startswith("sqlite"):
            await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
        # Migração leve: colunas novas em DBs já existentes
        for stmt in (
            "ALTER TABLE markers ADD COLUMN city VARCHAR(120) DEFAULT ''",
            "ALTER TABLE annotations ADD COLUMN author_name VARCHAR(120) DEFAULT ''",
            "ALTER TABLE annotations ADD COLUMN author_username VARCHAR(50) DEFAULT ''",
            "ALTER TABLE attachments ADD COLUMN is_primary BOOLEAN DEFAULT 0",
            "ALTER TABLE journeys ADD COLUMN map_color VARCHAR(20)",
            "ALTER TABLE markers ADD COLUMN is_departure BOOLEAN DEFAULT 0",
            "ALTER TABLE markers ADD COLUMN transport VARCHAR(20)",
        ):
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
