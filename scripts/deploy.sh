#!/usr/bin/env bash
# Deploy rápido em servidor: build + up
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Falta .env — copie .env.example e configure as senhas."
  exit 1
fi

docker compose pull db || true
docker compose up -d --build

echo "Serviços:"
docker compose ps
echo
echo "Health API (interno):"
docker compose exec -T api curl -sf http://localhost:8000/health || true
echo
echo "App: http://localhost:${HTTP_PORT:-80}"
