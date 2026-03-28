# CrudeMap

Global petroleum dependency mapping and disruption simulation platform.

## Quick Start

### 1. Start the backend + database

```bash
cd g:/Project/CrudeMap
docker compose up -d db
```

Wait for Postgres to be healthy, then run migrations and seed:

```bash
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m etl.seed
```

Then start the backend:

```bash
docker compose up backend
```

API available at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### 2. Start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App available at: http://localhost:5173

---

## Architecture

```
backend/
  app/          FastAPI app (models, schemas, repositories, API routes)
  etl/          Data loaders (JsonLoader) + seed runner
  scoring/      Pure scoring formulas + engine
  simulation/   NetworkX-based disruption engine
  alembic/      DB migrations

frontend/
  src/
    api/        Axios client + SWR hooks + TypeScript types
    components/ Map layers, panels, charts, simulation UI
    config/     Feature flags
    store/      Zustand stores (map state, scenario state)
```

## Extending

- **New data source**: implement `DataLoader` in `backend/etl/loaders/` and pass it to `seed(loader=MyLoader())`
- **Refresh canonical crude data**: place normalized `energy_institute`, `jodi`, `eia`, and `comtrade` CSV/JSON exports under `backend/etl/sources/`, then run `docker compose run --rm backend python -m etl.refresh --write-seed`
- **New scenario**: add an entry to `backend/etl/data/scenarios.json` and re-seed
- **New country**: add to `countries.json` + flows + update `COUNTRY_COORDS` in `FlowLayer.tsx`
- **Toggle a feature**: edit `frontend/src/config/features.ts`
- **New API field**: add column to model → `alembic revision --autogenerate` → migrate
