#!/usr/bin/env bash
# Sobe o Postgres do compose, cria tabelas via API, migra o SQLite local
# (api/mapa_retrato.db) + copia uploads, e sobe o web.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Criando .env a partir de .env.example…"
  cp .env.example .env
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

SQLITE_PATH="${SQLITE_PATH:-$ROOT/api/mapa_retrato.db}"
UPLOADS_SRC="${UPLOADS_SRC:-$ROOT/api/uploads}"

if [[ ! -f "$SQLITE_PATH" ]]; then
  echo "ERRO: SQLite não encontrado: $SQLITE_PATH"
  exit 1
fi

echo "==> Build + subindo db e api…"
docker compose up -d --build db api

echo "==> Aguardando API healthy…"
ok=0
for i in $(seq 1 90); do
  if docker compose exec -T api curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "ERRO: API não ficou healthy a tempo. Logs:"
  docker compose logs --tail=40 api
  exit 1
fi

echo "==> Instalando psycopg no container da API (migração)…"
docker compose exec -T api pip install -q 'psycopg[binary]' >/dev/null

echo "==> Copiando SQLite para o container…"
docker compose cp "$SQLITE_PATH" api:/tmp/mapa_retrato.db

# URL no formato esperado pelo migrate_sqlite_to_postgres.py
PG_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"

echo "==> Migrando dados SQLite → Postgres (truncate)…"
docker compose cp "$ROOT/scripts/migrate_sqlite_to_postgres.py" api:/tmp/migrate_sqlite_to_postgres.py
docker compose exec -T api env DATABASE_URL="$PG_URL" \
  python /tmp/migrate_sqlite_to_postgres.py --sqlite /tmp/mapa_retrato.db --truncate

if [[ -d "$UPLOADS_SRC" ]] && [[ -n "$(ls -A "$UPLOADS_SRC" 2>/dev/null || true)" ]]; then
  echo "==> Copiando uploads → volume da API…"
  docker compose cp "$UPLOADS_SRC/." api:/app/uploads/
else
  echo "==> Sem uploads locais para copiar."
fi

echo "==> Subindo web…"
docker compose up -d --build web

echo
echo "Pronto."
echo "  App: http://localhost:${HTTP_PORT:-80}"
echo "  Health: docker compose exec -T api curl -sf http://localhost:8000/health"
echo
echo "Usuário de teste (se existir no SQLite migrado): veja /p/<username>"
