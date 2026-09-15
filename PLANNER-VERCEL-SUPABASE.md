# Planner — migrar Lume Maps para Vercel + Supabase

Instruções para um agente (ou humano): **leia este arquivo e execute fase a fase**.
Objetivo: deploy **totalmente funcional** com compute na **Vercel** (front + API FastAPI serverless) e dados/arquivos no **Supabase** (Postgres + Storage).

Não apague `api/mapa_retrato.db` nem `api/uploads/` sem backup. Não faça commit salvo pedido explícito.

---

## Contexto do projeto

| Item | Valor atual | Destino |
|------|-------------|---------|
| Front | React/Vite em `web/` | Vercel (static + SPA rewrites) |
| API | FastAPI + uvicorn em `api/` | Vercel Serverless Functions |
| Banco dev | `api/mapa_retrato.db` (SQLite) | Supabase Postgres |
| Banco prod (Docker) | Postgres no Compose | **Substituído** pelo Supabase |
| Uploads | `api/uploads/` + `StaticFiles` | Supabase Storage (bucket `uploads`) |
| Auth | JWT custom (`auth.py`) | **Manter** JWT custom (sem Supabase Auth nesta fase) |
| Usuário de referência | `felippebaudelaire` | Smoke test pós-migração |

### Por que Supabase (e não “só Vercel”)

A Vercel **não** oferece disco persistente nem Postgres embutido no plano gratuito de forma plug-and-play para este stack. O deploy “só Vercel” significa:

- **Compute** (front + API) → Vercel
- **Dados + arquivos** → Supabase (ou Vercel Postgres + Vercel Blob — alternativa equivalente)

Esta migração usa **Supabase** por reunir Postgres + Storage + free tier generoso.

### Rotas da API (referência)

| Grupo | Prefixo | Arquivo |
|-------|---------|---------|
| Auth | `/auth/*` | `api/app/routers/auth.py` |
| Journeys, markers, upload, passports | `/journeys/*`, `/upload`, `/passports/*` | `api/app/routers/journeys.py` |
| Health | `/health` | `api/app/main.py` |

---

## Arquitetura alvo

```
Browser
   │
   ▼
┌──────────────────────────────────────┐
│  Vercel (mesmo domínio)              │
│  ├─ /*           → web/dist (SPA)    │
│  └─ /api/*       → FastAPI serverless│
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
 Supabase Postgres   Supabase Storage
 (pooler :6543)      (bucket uploads)
```

---

## Fases da migração

Execute na ordem. **Não pule para deploy antes de validar localmente com Supabase.**

| Fase | Nome | Entregável |
|------|------|------------|
| 0 | Pré-requisitos | Projeto Supabase + vars anotadas |
| 1 | Schema no Supabase | Tabelas criadas no Postgres remoto |
| 2 | Adaptar API | Código pronto para serverless + Storage |
| 3 | Migrar dados | SQLite + uploads → Supabase |
| 4 | Vercel | `vercel.json` raiz + deploy preview |
| 5 | Validação | Smoke tests em produção |

---

## Fase 0 — Pré-requisitos

### 0.1 Contas e CLI

```bash
# Vercel CLI (login uma vez)
npm i -g vercel
vercel login

# Supabase CLI (opcional, mas útil)
npm i -g supabase
supabase login
```

### 0.2 Criar projeto Supabase

1. [supabase.com](https://supabase.com) → New project
2. Anotar:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (só server-side, nunca no front)
   - **Database password**
3. Em **Settings → Database → Connection string**:
   - Modo **Transaction pooler** (porta **6543**)
   - URI para `DATABASE_URL` (asyncpg)

Exemplo de formato (não copie credenciais reais):

```
postgresql+asyncpg://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 0.3 Bucket de Storage

No dashboard Supabase → **Storage**:

1. Criar bucket `uploads`
2. **Public bucket**: sim (fotos/PDFs servidos por URL pública)
3. Policy mínima: leitura pública; escrita só via service key na API

### 0.4 Variáveis de ambiente (lista completa)

| Variável | Onde | Descrição |
|----------|------|-----------|
| `DATABASE_URL` | Vercel (API) | Postgres Supabase via pooler :6543 |
| `SECRET_KEY` | Vercel (API) | JWT — gerar string longa aleatória |
| `FRONTEND_URL` | Vercel (API) | `https://<app>.vercel.app` (atualizar após 1º deploy) |
| `SUPABASE_URL` | Vercel (API) | URL do projeto |
| `SUPABASE_SERVICE_KEY` | Vercel (API) | service_role |
| `SUPABASE_STORAGE_BUCKET` | Vercel (API) | `uploads` (default) |
| `VITE_API_BASE` | Vercel (Build) | `/api` (mesmo domínio) |

**Checklist fase 0**

```
[ ] Projeto Supabase criado
[ ] DATABASE_URL (pooler 6543) anotada
[ ] SUPABASE_URL + SUPABASE_SERVICE_KEY anotados
[ ] Bucket uploads criado (público)
[ ] SECRET_KEY de produção gerada
[ ] vercel login OK
```

---

## Fase 1 — Schema no Supabase

### 1.1 Criar tabelas

Opção A — script one-shot (recomendado para esta migração):

```bash
cd api
source .venv/bin/activate  # ou criar venv
pip install -r requirements.txt

export DATABASE_URL="postgresql+asyncpg://..."  # pooler Supabase
python -c "
import asyncio
from app.database import create_tables
asyncio.run(create_tables())
print('Tabelas criadas')
"
```

Opção B — exportar SQL dos models SQLAlchemy e rodar no SQL Editor do Supabase.

### 1.2 Conferir tabelas

Ordem de FKs (mesma do script existente):

```
users → passports → journeys → markers → annotations, attachments, stamps
journey_companions
```

No Supabase **Table Editor**, confirmar 8 tabelas.

### 1.3 Desativar `create_tables` no boot de produção

Em serverless, **não** rodar DDL a cada cold start. Após schema criado:

- Remover `create_tables()` do `lifespan` em `main.py`, **ou**
- Guardar com flag `RUN_MIGRATIONS=true` só no deploy inicial

**Checklist fase 1**

```
[ ] 8 tabelas existem no Supabase
[ ] Índices/uniques (email, username, slug) presentes
[ ] Decisão documentada sobre create_tables no lifespan
```

---

## Fase 2 — Adaptar a API para serverless + Storage

### 2.1 `database.py` — pool serverless

Alterações necessárias:

```python
from sqlalchemy.pool import NullPool

engine = create_async_engine(
    database_url,
    echo=False,
    poolclass=NullPool,  # obrigatório em Vercel/serverless
)
```

Manter conversão `postgresql://` → `postgresql+asyncpg://`.

### 2.2 `config.py` — novas settings

Adicionar:

```python
supabase_url: str = ""
supabase_service_key: str = ""
supabase_storage_bucket: str = "uploads"
is_serverless: bool = False  # ou detectar VERCEL env
```

Ler `VERCEL=1` para ajustes (ex.: não criar pasta local de upload).

### 2.3 Upload → Supabase Storage

**Arquivo:** `api/app/routers/journeys.py` — endpoint `POST /upload`

Substituir gravação em disco por upload HTTP ao Storage:

- Dependência: `httpx` (já leve) ou `supabase-py`
- Retornar URL pública: `{SUPABASE_URL}/storage/v1/object/public/uploads/{name}`
- Manter validação: image/*, application/pdf, max 5MB

**Arquivo:** `api/app/main.py`

- Remover `app.mount("/uploads", StaticFiles(...))` em produção serverless
- Manter mount só se `not settings.is_serverless` (dev local)

### 2.4 `mediaUrl` no front

**Arquivo:** `web/src/lib/api.ts`

Hoje URLs relativas `/uploads/...` funcionam no dev. Após migração, URLs serão absolutas (https). Confirmar que `mediaUrl()` já trata `url.startsWith('http')` — **OK, sem mudança**.

Para dados migrados com path antigo `/uploads/foo.jpg`, ver Fase 3.2.

### 2.5 Entry point Vercel

**Criar:** `api/index.py`

```python
from app.main import app
```

A Vercel detecta FastAPI e expõe como serverless function.

### 2.6 `requirements.txt`

Adicionar se usar cliente oficial:

```
httpx>=0.27.0
# ou: supabase>=2.0.0
```

### 2.7 CORS

Em `main.py`, garantir que `settings.frontend_url` inclua:

- URL de preview Vercel (`https://*.vercel.app`) — pode usar regex ou lista após 1º deploy
- Domínio customizado final

**Checklist fase 2**

```
[ ] NullPool em database.py
[ ] Settings Supabase em config.py
[ ] POST /upload grava no Storage
[ ] StaticFiles /uploads desligado em serverless
[ ] api/index.py criado
[ ] requirements.txt atualizado
[ ] Teste local: DATABASE_URL=supabase + upload → URL pública
```

---

## Fase 3 — Migrar dados existentes

### 3.1 SQLite → Supabase Postgres

Reutilizar `scripts/migrate_sqlite_to_postgres.py`:

```bash
cd mapa-retrato
pip install 'psycopg[binary]'  # se necessário

export DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres"
python3 scripts/migrate_sqlite_to_postgres.py --truncate
```

> `--truncate` só em banco **vazio/recém-criado**. Nunca em produção com usuários reais sem backup.

Validar contagem:

```bash
# no Supabase SQL Editor
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'journeys', COUNT(*) FROM journeys
UNION ALL SELECT 'markers', COUNT(*) FROM markers;
```

### 3.2 Uploads locais → Supabase Storage

**Criar script:** `scripts/migrate_uploads_to_supabase.py`

Lógica:

1. Listar arquivos em `api/uploads/`
2. Para cada arquivo, `PUT` no bucket `uploads` com service key
3. Atualizar no Postgres URLs que começam com `/uploads/`:
   - `attachments.url`
   - `passports.photo_url`
   - `journeys.cover_url`
   - (outros campos com path relativo)

SQL de exemplo pós-upload:

```sql
UPDATE attachments
SET url = 'https://[ref].supabase.co/storage/v1/object/public/uploads/' ||
            REPLACE(url, '/uploads/', '')
WHERE url LIKE '/uploads/%';
```

(Repetir para passports e journeys.)

### 3.3 JWT / senhas

Usuários migrados mantêm `hashed_password` — login continua igual.
**Trocar `SECRET_KEY` invalida tokens antigos** — usuários precisam logar de novo (aceitável no 1º deploy).

**Checklist fase 3**

```
[ ] migrate_sqlite_to_postgres.py rodou sem erro
[ ] Contagens batem com SQLite
[ ] Arquivos em api/uploads/ no bucket
[ ] URLs /uploads/... atualizadas para URLs Supabase
[ ] Foto do passaporte felippebaudelaire abre no browser
```

---

## Fase 4 — Deploy na Vercel

### 4.1 `vercel.json` na raiz do repo

**Criar:** `vercel.json` (raiz, não só em `web/`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd web && npm ci && npm run build",
  "outputDirectory": "web/dist",
  "installCommand": "cd web && npm ci",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ]
}
```

Ajustar se a Vercel exigir `rootDirectory: web` no dashboard — nesse caso, mover/configurar a function Python conforme [docs FastAPI Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

### 4.2 Configuração do projeto Vercel

| Setting | Valor |
|---------|-------|
| Framework Preset | Vite (ou Other) |
| Root Directory | `.` (repo root) ou `web` + functions na raiz |
| Build Command | ver `vercel.json` |
| Output Directory | `web/dist` |

### 4.3 Environment Variables (Vercel dashboard)

Configurar para **Production** e **Preview**:

- Todas da tabela Fase 0.4
- `VITE_API_BASE=/api`

### 4.4 Primeiro deploy

```bash
cd mapa-retrato
vercel          # preview
vercel --prod   # produção (só após smoke OK)
```

Após 1º deploy, atualizar `FRONTEND_URL` com a URL real e redeploy.

### 4.5 Domínio customizado (opcional)

Vercel → Settings → Domains → apontar DNS.
Atualizar `FRONTEND_URL` de novo.

**Checklist fase 4**

```
[ ] vercel.json na raiz commitado
[ ] Env vars configuradas no dashboard
[ ] Deploy preview OK
[ ] GET https://<preview>/api/health → {"status":"ok"}
[ ] SPA abre em https://<preview>/
[ ] FRONTEND_URL atualizada
[ ] Deploy production (se preview OK)
```

---

## Fase 5 — Validação (smoke tests)

### 5.1 API

```bash
BASE=https://<seu-app>.vercel.app

curl -sf "$BASE/api/health"
curl -sf "$BASE/api/passports/felippebaudelaire" | head -c 200
```

### 5.2 Browser

1. `/p/felippebaudelaire` — passaporte, carimbos, foto
2. `/v/<slug>` — mapa, marcadores, polyline
3. Login com conta migrada
4. Criar marcador + upload de foto → URL Supabase no DOM
5. Companheiro: buscar passaporte + join em mapa (se dados existirem)

### 5.3 Regressões conhecidas

| Área | O que observar |
|------|----------------|
| Cold start | 1ª request pode levar 2–5s |
| Upload 5MB | Dentro do limite Vercel body |
| Refresh token | POST `/api/auth/refresh` |
| CORS | Só relevante se `VITE_API_BASE` apontar domínio externo |

**Checklist fase 5**

```
[ ] /api/health OK
[ ] Passaporte público carrega
[ ] Mapa público carrega
[ ] Login + /auth/me OK
[ ] Upload nova foto OK
[ ] Editar mapa (PATCH) OK
[ ] Fotos antigas (migradas) OK
```

---

## Arquivos a criar ou modificar

| Arquivo | Ação |
|---------|------|
| `PLANNER-VERCEL-SUPABASE.md` | Este planner |
| `vercel.json` (raiz) | Criar — build web + rewrite `/api` |
| `api/index.py` | Criar — entry Vercel |
| `api/app/database.py` | NullPool + pooler |
| `api/app/config.py` | vars Supabase |
| `api/app/main.py` | lifespan sem DDL; StaticFiles condicional |
| `api/app/routers/journeys.py` | upload Storage |
| `api/requirements.txt` | httpx ou supabase |
| `scripts/migrate_uploads_to_supabase.py` | Criar |
| `web/vercel.json` | Manter ou consolidar na raiz |
| `.env.example` | Documentar vars Supabase + Vercel |
| `README.md` | Link para este planner (opcional) |

---

## Problemas comuns

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| 500 na API, "too many connections" | Pooler errado ou sem NullPool | Usar porta **6543** + `NullPool` |
| Timeout 10s | Cold start + query pesada | Otimizar; plano Pro = 60s |
| Fotos 404 | URL ainda `/uploads/...` | Rodar script Fase 3.2 |
| CORS error | `FRONTEND_URL` desatualizada | Igualar URL exata do front |
| Upload 413 | Body > limite Vercel | Manter max 5MB |
| Login OK local, falha prod | `SECRET_KEY` diferente | Mesma key em todos envs |
| Tabelas duplicadas / erro DDL | `create_tables` no lifespan | Desligar após Fase 1 |
| Module not found na Vercel | `requirements.txt` incompleto | Conferir deps em `api/` |

---

## Rollback

1. Front continua funcionando com Docker local (`PLANNER-INICIAR.md` modo B)
2. Supabase: backup automático diário (plano pago) — no free, export manual antes de `--truncate`
3. Reverter deploy Vercel: Deployments → Promote previous

---

## Estimativa de esforço

| Fase | Tempo (dev familiarizado) |
|------|---------------------------|
| 0–1 Setup Supabase | 30–45 min |
| 2 Adaptar API | 2–4 h |
| 3 Migrar dados | 1–2 h |
| 4–5 Deploy + testes | 1–2 h |
| **Total** | **~1 dia** |

---

## Fora de escopo (fase 2 futura)

- Substituir JWT por Supabase Auth
- RLS no Postgres (hoje a API controla permissões)
- Alembic formal (substituir `create_tables` + ALTERs ad hoc)
- CI/CD automático (GitHub → Vercel já faz deploy on push)
- Vercel Postgres + Blob em vez de Supabase

---

## Mensagem curta para colar no chat do agente

```
Leia mapa-retrato/PLANNER-VERCEL-SUPABASE.md e execute a migração
fase a fase (0→5). Comece pela Fase 0 assumindo que ainda não tenho
projeto Supabase — me peça as credenciais quando precisar.

Prioridade: adaptar API (NullPool + Supabase Storage + api/index.py),
migrar api/mapa_retrato.db e api/uploads/, depois vercel.json na raiz
e deploy preview. Valide /p/felippebaudelaire e upload de foto antes
do deploy --prod. Não commite sem eu pedir.
```

---

## Ordem de execução resumida (TL;DR)

```
0. Criar Supabase + bucket uploads
1. create_tables() uma vez no Postgres remoto
2. Patches: database.py, config.py, upload, main.py, index.py
3. migrate_sqlite_to_postgres.py + migrate_uploads_to_supabase.py
4. vercel.json + env vars + vercel / vercel --prod
5. Smoke: health, passaporte, mapa, login, upload
```
