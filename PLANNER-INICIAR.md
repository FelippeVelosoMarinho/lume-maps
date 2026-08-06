# Planner — iniciar Lume Maps com os dados atuais

Instruções para um agente (ou humano): **leia este arquivo e execute**.
Objetivo: subir o Lume Maps **já com o banco e uploads que estão neste repositório agora** (`api/mapa_retrato.db` + `api/uploads/`).

Não invente dados. Não limpe o SQLite. Não faça commit salvo pedido explícito.

---

## Contexto do projeto

| Item | Valor |
|------|--------|
| Pasta | `mapa-retrato/` (repo Lume Maps) |
| Banco atual (dev) | `api/mapa_retrato.db` (SQLite) |
| Uploads | `api/uploads/` |
| Web | React/Vite → porta **5173** (dev) ou **80** (Docker) |
| API | FastAPI → porta **8000** |
| Usuário conhecido nos dados | `felippebaudelaire` (passaporte `/p/felippebaudelaire`) |

---

## Escolha o modo

### A — Desenvolvimento local (padrão, mais rápido)

Usa o SQLite **direto**, sem Docker.

```bash
cd mapa-retrato
chmod +x scripts/*.sh
./scripts/start-with-data.sh local
```

**Pronto quando:**

- `curl -sf http://127.0.0.1:8000/health` responde OK
- http://localhost:5173 abre
- Login / passaporte `/p/felippebaudelaire` mostra dados e fotos

**API manual (se o script falhar):**

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=sqlite+aiosqlite:///./mapa_retrato.db
export UPLOAD_DIR=./uploads
export SECRET_KEY=dev-local-secret
export FRONTEND_URL=http://localhost:5173
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Web manual:**

```bash
cd web && npm install && npm run dev -- --host 0.0.0.0 --port 5173
```

> Importante: a API **precisa** de `--reload` (ou restart) após mudanças de rotas. Sem reload, rotas novas dão 404.

---

### B — Servidor / Docker (Postgres + dados migrados)

Copia o SQLite atual → Postgres do Compose e sobe web/api/db.

```bash
cd mapa-retrato
cp -n .env.example .env   # se ainda não existir .env
# Em produção: edite POSTGRES_PASSWORD, SECRET_KEY, FRONTEND_URL, HTTP_PORT

chmod +x scripts/*.sh
./scripts/start-with-data.sh docker
# equivalente: ./scripts/clone-local-db.sh
```

**O que o script faz:**

1. `docker compose up -d --build db api`
2. Espera health da API (cria tabelas)
3. Roda `scripts/migrate_sqlite_to_postgres.py --truncate` **dentro** do container
4. Copia `api/uploads/` → volume `uploads`
5. Sobe `web`

**App:** `http://localhost:${HTTP_PORT:-80}`

**Só redeploy sem remarcar dados:**

```bash
./scripts/deploy.sh
```

---

## Checklist do agente (copiar)

```
[ ] cd para mapa-retrato/
[ ] Confirmar que existem: api/mapa_retrato.db e api/uploads/
[ ] chmod +x scripts/*.sh
[ ] Escolher modo A (local) ou B (docker)
[ ] Rodar ./scripts/start-with-data.sh local   OU   docker
[ ] Validar GET /health
[ ] Abrir app no browser
[ ] Smoke: /p/felippebaudelaire e um mapa /v/<slug>
[ ] Reportar URLs e se os dados/fotos apareceram
```

---

## Smoke tests mínimos

1. **Health**
   - Local: `curl -sf http://127.0.0.1:8000/health`
   - Docker: `docker compose exec -T api curl -sf http://localhost:8000/health`

2. **Passaporte**
   - Abrir `/p/felippebaudelaire`
   - Deve listar mapas, carimbos e foto (se houver em uploads)

3. **Mapa**
   - Abrir um `/v/<slug>` dos mapas do perfil
   - Marcadores e polyline devem aparecer

4. **Auth (opcional)**
   - Login com a conta que já está no SQLite (mesmo e-mail/senha já cadastrados)

---

## Arquivos de script

| Script | Função |
|--------|--------|
| `scripts/start-with-data.sh` | Entry point: `local` ou `docker` |
| `scripts/clone-local-db.sh` | Migra SQLite→Postgres + uploads + sobe web |
| `scripts/migrate_sqlite_to_postgres.py` | Migração de tabelas (pula tabela ausente no SQLite) |
| `scripts/deploy.sh` | Build/up Docker **sem** remigrar dados |

---

## Problemas comuns

| Sintoma | Ação |
|---------|------|
| 404 em rotas novas da API | Reiniciar uvicorn **com** `--reload` |
| Fotos quebradas | Conferir `api/uploads/` e `UPLOAD_DIR` / volume Docker |
| Porta 80/5173/8000 ocupada | Matar processo ou mudar `HTTP_PORT` no `.env` |
| Migração Docker falha | `docker compose logs api` e `db`; garantir `.env` coerente |
| Postgres vazio após deploy | Rodar `./scripts/clone-local-db.sh` (deploy sozinho **não** importa o SQLite) |

---

## Depois de iniciar — o que **não** fazer

- Não apagar `api/mapa_retrato.db` sem backup
- Não rodar migrate com `--truncate` em Postgres de produção sem confirmação
- Não commitar `.env` nem uploads grandes sem pedido

---

## Mensagem curta para colar no chat do agente

```
Leia mapa-retrato/PLANNER-INICIAR.md e inicie o Lume Maps
com os dados atuais (api/mapa_retrato.db + api/uploads).
Use o modo local (./scripts/start-with-data.sh local)
salvo se eu pedir Docker. No final me passe as URLs e
confirme que o passaporte /p/felippebaudelaire carrega.
```
