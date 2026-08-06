# Lume Maps

Licença permanente de viagem + mapas compartilháveis (lugares, fotos, notas).

## Stack

| Serviço | Tech |
|---------|------|
| **web** | React + Vite + Tailwind + Leaflet (nginx) |
| **api** | FastAPI + SQLAlchemy + JWT |
| **db** | PostgreSQL 16 |

## Desenvolvimento local (sem Docker)

### API

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
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

Com a API já tendo criado as tabelas:

```bash
./scripts/clone-local-db.sh
```

Isso:

1. Sobe `db` + `api`
2. Migra `api/mapa_retrato.db` → Postgres
3. Copia `api/uploads/` para o volume
4. Sobe o `web`

Script Python avulso (Postgres acessível na máquina):

```bash
pip install 'psycopg[binary]'
DATABASE_URL=postgresql://lume:SENHA@127.0.0.1:5432/lume_maps \
  python3 scripts/migrate_sqlite_to_postgres.py --truncate
```

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
4. Compartilhar `/v/:slug`
