from contextlib import asynccontextmanager
import os
import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import create_tables
from app.routers import auth_router, journeys_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.should_run_migrations_on_startup:
        await create_tables()
    if not settings.use_supabase_storage:
        os.makedirs(settings.upload_dir, exist_ok=True)
    logger.info("Mapa-Retrato API pronta (serverless=%s)", settings.is_serverless)
    yield


app = FastAPI(
    title="Mapa-Retrato API",
    description="Porta-retrato de viagem — passaporte + mapa compartilhável",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins = [
    o
    for o in [
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://localhost",
        "http://127.0.0.1",
    ]
    if o
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter()
api.include_router(auth_router)
api.include_router(journeys_router)


@api.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api, prefix=settings.api_prefix)

if not settings.use_supabase_storage:
    os.makedirs(settings.upload_dir, exist_ok=True)
    mount_path = f"{settings.api_prefix}/uploads" if settings.api_prefix else "/uploads"
    app.mount(mount_path, StaticFiles(directory=settings.upload_dir), name="uploads")
