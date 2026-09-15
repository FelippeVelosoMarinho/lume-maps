import os

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./mapa_retrato.db"
    secret_key: str = "mapa-retrato-dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    refresh_token_expire_days: int = 30
    frontend_url: str = "http://localhost:5173"
    upload_dir: str = "./uploads"
    max_file_size: int = 5_242_880  # 5MB
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "uploads"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

    @property
    def is_serverless(self) -> bool:
        return os.getenv("VERCEL") == "1"

    @property
    def api_prefix(self) -> str:
        return "/api" if self.is_serverless else ""

    @property
    def use_supabase_storage(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_service_key.strip())

    @property
    def should_run_migrations_on_startup(self) -> bool:
        explicit = os.getenv("RUN_MIGRATIONS")
        if explicit is not None:
            return explicit.lower() in ("1", "true", "yes")
        return not self.is_serverless


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
