#!/usr/bin/env bash
# Sobe Lume Maps usando os dados atuais do SQLite (api/mapa_retrato.db) + uploads.
#
# Modos:
#   ./scripts/start-with-data.sh          → Dev local (API + Vite), SQLite atual
#   ./scripts/start-with-data.sh docker   → Docker: migra SQLite → Postgres e sobe stack
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-local}"
SQLITE_PATH="${SQLITE_PATH:-$ROOT/api/mapa_retrato.db}"
UPLOADS_SRC="${UPLOADS_SRC:-$ROOT/api/uploads}"

if [[ ! -f "$SQLITE_PATH" ]]; then
  echo "ERRO: SQLite não encontrado em $SQLITE_PATH"
  exit 1
fi

start_local() {
  echo "==> Modo LOCAL (SQLite + uploads atuais)"
  echo "    DB: $SQLITE_PATH"
  echo

  if [[ ! -d api/.venv ]]; then
    echo "==> Criando venv da API…"
    python3 -m venv api/.venv
    api/.venv/bin/pip install -q -r api/requirements.txt
  fi

  if [[ ! -d web/node_modules ]]; then
    echo "==> npm install (web)…"
    (cd web && npm install)
  fi

  # mata processos anteriores nas portas (opcional / best-effort)
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
  fi

  echo "==> API em :8000 (reload)…"
  (
    cd api
    # Garante DATABASE_URL apontando para o SQLite local
    export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./mapa_retrato.db}"
    export UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
    export SECRET_KEY="${SECRET_KEY:-dev-local-secret}"
    export FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
    .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ) &
  API_PID=$!

  cleanup() {
    echo
    echo "==> Encerrando…"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  # espera health
  for _ in $(seq 1 40); do
    if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  echo "==> Web em :5173…"
  echo
  echo "────────────────────────────────────────"
  echo "  App:  http://localhost:5173"
  echo "  API:  http://localhost:8000"
  echo "  Docs: http://localhost:8000/docs"
  echo "  DB:   $SQLITE_PATH (dados atuais)"
  echo "────────────────────────────────────────"
  echo

  (cd web && npm run dev -- --host 0.0.0.0 --port 5173)
}

start_docker() {
  echo "==> Modo DOCKER (migra SQLite → Postgres + uploads)"
  echo "    DB origem: $SQLITE_PATH"
  echo

  if [[ ! -f .env ]]; then
    echo "==> Criando .env a partir de .env.example…"
    cp .env.example .env
    echo "    Revise senhas em .env se for produção."
  fi

  chmod +x scripts/*.sh 2>/dev/null || true
  ./scripts/clone-local-db.sh
}

case "$MODE" in
  local|dev|"")
    start_local
    ;;
  docker|server|prod)
    start_docker
    ;;
  *)
    echo "Uso: $0 [local|docker]"
    echo "  local  (padrão) — uvicorn + vite com SQLite atual"
    echo "  docker          — Postgres no Compose + migração dos dados atuais"
    exit 1
    ;;
esac
