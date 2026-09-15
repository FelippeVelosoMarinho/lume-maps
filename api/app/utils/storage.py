from fastapi import HTTPException
import httpx

from app.config import settings


def public_storage_url(object_name: str) -> str:
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_storage_bucket
    return f"{base}/storage/v1/object/public/{bucket}/{object_name}"


async def upload_to_supabase(name: str, content: bytes, content_type: str) -> str:
    if not settings.use_supabase_storage:
        raise HTTPException(status_code=500, detail="Supabase Storage não configurado")

    upload_url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{settings.supabase_storage_bucket}/{name}"
    )
    # Chaves sb_secret_* usam header apikey (não Authorization Bearer — não são JWT)
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            upload_url,
            content=content,
            headers={
                "apikey": settings.supabase_service_key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
    if res.status_code not in (200, 201):
        detail = res.text[:300] if res.text else f"HTTP {res.status_code}"
        raise HTTPException(status_code=502, detail=f"Falha no upload Supabase: {detail}")

    return public_storage_url(name)
