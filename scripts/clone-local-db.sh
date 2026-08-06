#!/usr/bin/env bash
# Sobe o Postgres do compose (se precisar), espera healthy, migra o SQLite local
# e copia a pasta de uploads para o volume da API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Criando .env a partir de .env.example…"
  cp .env.example .env
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

SQLITE_PATH="${SQLITE_PATH:-$ROOT/api/mapa_retrato.db}"
UPLOADS_SRC="${UPLOADS_SRC:-$ROOT/api/uploads}"

echo "==> Subindo Postgres (e API para criar tabelas)…"
docker compose up -d db api

echo "==> Aguardando API healthy…"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    break
  fi
  # health interno; porta só no web. Checa via compose exec:
  if docker compose exec -T api curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Expondo Postgres temporariamente na 5433 para migração…"
# usa network do compose + psql no container python one-shot
docker compose exec -T api pip install -q 'psycopg[binary]' >/dev/null

DB_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"

echo "==> Migrando dados SQLite → Postgres…"
docker compose cp "$SQLITE_PATH" api:/tmp/mapa_retrato.db
docker compose exec -T api python - <<PY
import sqlite3, os
import psycopg

SQLITE = "/tmp/mapa_retrato.db"
DSN = "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
TABLES = [
    "users", "passports", "journeys", "markers",
    "annotations", "attachments", "stamps", "journey_companions",
]

src = sqlite3.connect(SQLITE)
src.row_factory = sqlite3.Row
with psycopg.connect(DSN) as dst:
    with dst.cursor() as cur:
        for t in reversed(TABLES):
            cur.execute(f'TRUNCATE TABLE "{t}" CASCADE')
        for t in TABLES:
            rows = src.execute(f"SELECT * FROM {t}").fetchall()
            if not rows:
                print(f"  {t}: 0")
                continue
            cols = [d[0] for d in src.execute(f"SELECT * FROM {t} LIMIT 0").description]
            ph = ", ".join(["%s"] * len(cols))
            col_list = ", ".join(f'"{c}"' for c in cols)
            sql = f'INSERT INTO "{t}" ({col_list}) VALUES ({ph}) ON CONFLICT DO NOTHING'
            cur.executemany(sql, [tuple(r[c] for c in cols) for r in rows])
            print(f"  {t}: {len(rows)}")
    dst.commit()
src.close()
print("OK")
PY

if [[ -d "$UPLOADS_SRC" ]] && [[ -n "$(ls -A "$UPLOADS_SRC" 2>/dev/null || true)" ]]; then
  echo "==> Copiando uploads…"
  docker compose cp "$UPLOADS_SRC/." api:/app/uploads/
else
  echo "==> Sem uploads locais para copiar."
fi

echo "==> Subindo web…"
docker compose up -d web

echo
echo "Pronto. Abra http://localhost:${HTTP_PORT:-80}"
echo "Para rebuild completo: docker compose up -d --build"
