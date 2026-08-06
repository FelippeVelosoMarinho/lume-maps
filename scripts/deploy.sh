#!/usr/bin/env bash
# Deploy rápido em servidor: build + up (não remigra SQLite)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Falta .env — copie .env.example e configure as senhas."
  echo "  cp .env.example .env"
  echo "Para subir JÁ com os dados do SQLite local: ./scripts/start-with-data.sh docker"
  exit 1
fi

docker compose pull db || true
docker compose up -d --build

echo "Serviços:"
docker compose ps
echo
echo "Health API:"
docker compose exec -T api curl -sf http://localhost:8000/health || true
echo
echo "App: http://localhost:${HTTP_PORT:-80}"
echo
echo "Nota: este script NÃO importa api/mapa_retrato.db."
echo "Para migrar dados atuais → Postgres: ./scripts/clone-local-db.sh"
