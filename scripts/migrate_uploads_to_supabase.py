#!/usr/bin/env python3
"""
Envia arquivos de api/uploads/ para o Supabase Storage e atualiza URLs no Postgres.

Uso:
  export SUPABASE_URL=https://xxxx.supabase.co
  export SUPABASE_SERVICE_KEY=eyJ...
  export DATABASE_URL=postgresql://postgres.[ref]:[pass]@...pooler.supabase.com:6543/postgres
  python3 scripts/migrate_uploads_to_supabase.py

  # só upload, sem atualizar banco:
  python3 scripts/migrate_uploads_to_supabase.py --skip-db

  # só atualizar URLs (arquivos já no bucket):
  python3 scripts/migrate_uploads_to_supabase.py --skip-upload
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_UPLOADS = ROOT / "api" / "uploads"

URL_COLUMNS = (
    ("attachments", "url"),
    ("passports", "photo_url"),
    ("journeys", "cover_url"),
)


def public_url(supabase_url: str, bucket: str, name: str) -> str:
    return f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{name}"


def to_psycopg_url(url: str) -> str:
    return (
        url.replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg://", "postgresql://")
    )


def connect_pg(url: str):
    try:
        import psycopg
    except ImportError:
        print("Instale psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        sys.exit(1)
    return psycopg.connect(to_psycopg_url(url))


def upload_files(uploads_dir: Path, supabase_url: str, service_key: str, bucket: str) -> int:
    try:
        import httpx
    except ImportError:
        print("Instale httpx: pip install httpx", file=sys.stderr)
        sys.exit(1)

    if not uploads_dir.is_dir():
        print(f"Pasta não encontrada: {uploads_dir}", file=sys.stderr)
        sys.exit(1)

    files = [f for f in uploads_dir.iterdir() if f.is_file() and f.name != ".gitkeep"]
    if not files:
        print("Nenhum arquivo em uploads/")
        return 0

    uploaded = 0
    with httpx.Client(timeout=60.0) as client:
        for path in sorted(files):
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path.name}"
            res = client.post(
                url,
                content=path.read_bytes(),
                headers={
                    "apikey": service_key,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
            if res.status_code not in (200, 201):
                print(f"  ERRO {path.name}: {res.status_code} {res.text[:200]}", file=sys.stderr)
                continue
            uploaded += 1
            print(f"  ↑ {path.name}")
    return uploaded


def rewrite_urls(database_url: str, supabase_url: str, bucket: str) -> None:
    base = public_url(supabase_url, bucket, "").rstrip("/") + "/"
    conn = connect_pg(database_url)
    with conn:
        with conn.cursor() as cur:
            for table, column in URL_COLUMNS:
                cur.execute(
                    f"""
                    UPDATE {table}
                    SET {column} = %s || REPLACE({column}, '/uploads/', '')
                    WHERE {column} LIKE '/uploads/%%'
                    """,
                    (base,),
                )
                print(f"  {table}.{column}: {cur.rowcount} linhas atualizadas")
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migra uploads locais → Supabase Storage")
    parser.add_argument(
        "--uploads-dir",
        type=Path,
        default=Path(os.environ.get("UPLOAD_DIR", DEFAULT_UPLOADS)),
    )
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL", ""))
    parser.add_argument(
        "--supabase-service-key",
        default=os.environ.get("SUPABASE_SERVICE_KEY", ""),
    )
    parser.add_argument(
        "--bucket",
        default=os.environ.get("SUPABASE_STORAGE_BUCKET", "uploads"),
    )
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--skip-db", action="store_true")
    args = parser.parse_args()

    if not args.supabase_url or not args.supabase_service_key:
        print("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY", file=sys.stderr)
        sys.exit(1)

    if not args.skip_upload:
        print(f"Upload: {args.uploads_dir} → bucket '{args.bucket}'")
        n = upload_files(args.uploads_dir, args.supabase_url, args.supabase_service_key, args.bucket)
        print(f"{n} arquivo(s) enviado(s)")

    if not args.skip_db:
        if not args.database_url:
            print("Defina DATABASE_URL para reescrever URLs no Postgres", file=sys.stderr)
            sys.exit(1)
        print("Atualizando URLs /uploads/... no Postgres")
        rewrite_urls(args.database_url, args.supabase_url, args.bucket)

    print("Concluído.")


if __name__ == "__main__":
    main()
