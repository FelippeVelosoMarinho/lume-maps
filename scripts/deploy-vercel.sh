#!/usr/bin/env bash
# Deploy Lume Maps na Vercel (front + API FastAPI serverless + Supabase)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Instale: npm i -g vercel"
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "Faça login primeiro: vercel login"
  exit 1
fi

# Carrega secrets locais (não commitar este arquivo)
ENV_FILE="${VERCEL_ENV_FILE:-$ROOT/.env.vercel}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DATABASE_URL:?Defina DATABASE_URL}"
: "${SUPABASE_URL:?Defina SUPABASE_URL}"
: "${SUPABASE_SERVICE_KEY:?Defina SUPABASE_SERVICE_KEY}"
: "${SECRET_KEY:?Defina SECRET_KEY}"

FRONTEND_URL="${FRONTEND_URL:-}"
VITE_API_BASE="${VITE_API_BASE:-/api}"
TARGET="${1:-preview}" # preview | prod

echo "→ Linkando projeto (se necessário)..."
vercel link --yes 2>/dev/null || vercel link

echo "→ Variáveis de ambiente..."
vercel env add DATABASE_URL production <<< "$DATABASE_URL" 2>/dev/null || true
vercel env add SUPABASE_URL production <<< "$SUPABASE_URL" 2>/dev/null || true
vercel env add SUPABASE_SERVICE_KEY production <<< "$SUPABASE_SERVICE_KEY" 2>/dev/null || true
vercel env add SECRET_KEY production <<< "$SECRET_KEY" 2>/dev/null || true
vercel env add VITE_API_BASE production <<< "$VITE_API_BASE" 2>/dev/null || true
if [[ -n "$FRONTEND_URL" ]]; then
  vercel env add FRONTEND_URL production <<< "$FRONTEND_URL" 2>/dev/null || true
fi

# Preview usa as mesmas vars
for var in DATABASE_URL SUPABASE_URL SUPABASE_SERVICE_KEY SECRET_KEY VITE_API_BASE FRONTEND_URL; do
  val="${!var:-}"
  [[ -n "$val" ]] && vercel env add "$var" preview <<< "$val" 2>/dev/null || true
done

BUILD_ARGS=(-b "VITE_API_BASE=$VITE_API_BASE")
RUN_ARGS=(
  -e "DATABASE_URL=$DATABASE_URL"
  -e "SUPABASE_URL=$SUPABASE_URL"
  -e "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY"
  -e "SECRET_KEY=$SECRET_KEY"
)
[[ -n "$FRONTEND_URL" ]] && RUN_ARGS+=(-e "FRONTEND_URL=$FRONTEND_URL")

if [[ "$TARGET" == "prod" ]]; then
  echo "→ Deploy PRODUCTION..."
  vercel deploy --prod "${BUILD_ARGS[@]}" "${RUN_ARGS[@]}"
else
  echo "→ Deploy preview..."
  vercel deploy "${BUILD_ARGS[@]}" "${RUN_ARGS[@]}"
fi

echo "✓ Deploy concluído. Atualize FRONTEND_URL com a URL final e redeploy se necessário."
