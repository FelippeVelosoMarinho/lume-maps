#!/usr/bin/env bash
# Sobe a API local com SQLite e uploads atuais do repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f mapa_retrato.db ]]; then
  echo "ERRO: mapa_retrato.db não encontrado em $ROOT"
  exit 1
fi

if [[ ! -d .venv ]]; then
  echo "==> Criando venv…"
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./mapa_retrato.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
export SECRET_KEY="${SECRET_KEY:-dev-local-secret}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "==> API em http://127.0.0.1:8000 (reload)"
echo "    DB: $ROOT/mapa_retrato.db"
echo "    Docs: http://127.0.0.1:8000/docs"
echo

exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
