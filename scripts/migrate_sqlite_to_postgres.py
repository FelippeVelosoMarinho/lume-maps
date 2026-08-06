#!/usr/bin/env python3
"""
Copia dados do SQLite local (api/mapa_retrato.db) para o Postgres do Docker/deploy.

Uso (com stack Docker no ar):
  ./scripts/clone-local-db.sh

Ou direto:
  DATABASE_URL=postgresql+psycopg://lume:pass@localhost:5432/lume_maps \
    python3 scripts/migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE = ROOT / "api" / "mapa_retrato.db"

# Ordem respeitando FKs
TABLES = [
    "users",
    "passports",
    "journeys",
    "markers",
    "annotations",
    "attachments",
    "stamps",
    "journey_companions",
]


def to_psycopg_url(url: str) -> str:
    """Converte postgresql+asyncpg://… para postgresql://… (psycopg)."""
    u = url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg://", "postgresql://"
    )
    return u


def connect_pg(url: str):
    try:
        import psycopg
    except ImportError:
        print("Instale psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        sys.exit(1)
    return psycopg.connect(to_psycopg_url(url))


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def migrate(sqlite_path: Path, database_url: str, truncate: bool) -> None:
    if not sqlite_path.exists():
        print(f"SQLite não encontrado: {sqlite_path}", file=sys.stderr)
        sys.exit(1)

    src = sqlite3.connect(str(sqlite_path))
    src.row_factory = sqlite3.Row
    dst = connect_pg(database_url)

    with dst:
        with dst.cursor() as cur:
            if truncate:
                # limpa em ordem inversa de FKs
                for table in reversed(TABLES):
                    cur.execute(f"TRUNCATE TABLE {quote_ident(table)} CASCADE")

            for table in TABLES:
                exists = src.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                    (table,),
                ).fetchone()
                if not exists:
                    print(f"  {table}: (não existe no SQLite — pulado)")
                    continue
                rows = src.execute(f"SELECT * FROM {table}").fetchall()
                if not rows:
                    print(f"  {table}: 0 linhas")
                    continue
                cols = [d[0] for d in src.execute(f"SELECT * FROM {table} LIMIT 0").description]
                placeholders = ", ".join(["%s"] * len(cols))
                col_list = ", ".join(quote_ident(c) for c in cols)
                sql = (
                    f"INSERT INTO {quote_ident(table)} ({col_list}) VALUES ({placeholders}) "
                    f"ON CONFLICT DO NOTHING"
                )
                payload = [tuple(r[c] for c in cols) for r in rows]
                cur.executemany(sql, payload)
                print(f"  {table}: {len(payload)} linhas")

    src.close()
    dst.close()
    print("Migração concluída.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migra SQLite local → Postgres")
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=Path(os.environ.get("SQLITE_PATH", DEFAULT_SQLITE)),
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get(
            "DATABASE_URL",
            "postgresql://lume:lume_change_me@127.0.0.1:5432/lume_maps",
        ),
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Apaga dados existentes no Postgres antes de inserir",
    )
    args = parser.parse_args()
    print(f"SQLite: {args.sqlite}")
    parsed = urlparse(to_psycopg_url(args.database_url))
    print(f"Postgres: {parsed.hostname}:{parsed.port or 5432}/{parsed.path.lstrip('/')}")
    migrate(args.sqlite, args.database_url, truncate=args.truncate)


if __name__ == "__main__":
    main()
