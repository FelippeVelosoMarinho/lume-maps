# Lume Maps

Licença permanente de viagem + mapas compartilháveis (lugares, fotos, notas).

## Início rápido (com os dados atuais)

Leia o planner e rode o script — usa o SQLite/uploads que já estão no repo:

→ **[PLANNER-INICIAR.md](./PLANNER-INICIAR.md)**

```bash
chmod +x scripts/*.sh
./scripts/start-with-data.sh local    # API :8000 + Vite :5173 (SQLite atual)
# ou
./scripts/start-with-data.sh docker   # Postgres + migração + nginx
```

## Stack

| Serviço | Tech |
|---------|------|
| **web** | React + Vite + Tailwind + Leaflet (nginx) |
| **api** | FastAPI + SQLAlchemy + JWT |
| **db** | SQLite (dev) / PostgreSQL 16 (Docker) |

## Desenvolvimento local (sem Docker)

### API

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=sqlite+aiosqlite:///./mapa_retrato.db
export UPLOAD_DIR=./uploads
uvicorn app.main:app --reload --port 8000
```

### Web

```bash
cd web
npm install
npm run dev
```

Abra http://localhost:5173 (proxy `/api` e `/uploads`).

## Docker (produção / servidor)

```bash
cp .env.example .env
# edite senhas: POSTGRES_PASSWORD, SECRET_KEY, FRONTEND_URL, HTTP_PORT

chmod +x scripts/*.sh
./scripts/deploy.sh
```

App em `http://localhost` (ou a porta de `HTTP_PORT`).

### Clonar dados do SQLite local → Postgres do Docker

```bash
./scripts/clone-local-db.sh
# ou: ./scripts/start-with-data.sh docker
```

Isso:

1. Sobe `db` + `api`
2. Migra `api/mapa_retrato.db` → Postgres
3. Copia `api/uploads/` para o volume
4. Sobe o `web`

## Variáveis de ambiente

Veja [`.env.example`](.env.example).

| Variável | Descrição |
|----------|-----------|
| `POSTGRES_*` | Credenciais do banco |
| `SECRET_KEY` | JWT |
| `FRONTEND_URL` | Origin do front (CORS) |
| `HTTP_PORT` | Porta publicada do nginx |
| `DATABASE_URL` | Só na API; no Compose é montada automaticamente |

## Fluxo do produto

1. Criar conta / passaporte em `/auth`
2. Perfil / convite em `/p/:username`
3. Criar mapa → `/v/:slug/edit`
4. Compartilhar `/v/:slug` (visitante sem conta vê landing; com conta entra no mapa)
