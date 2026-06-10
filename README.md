# CrudeMap

Interactive world map of global oil & gas: trade flows routed through maritime
chokepoints, traced pipelines, fields, terminals, refineries, LNG infrastructure,
container shipping corridors — plus a NetworkX-based supply-disruption simulator.

**v1.1** — Fully custom GIS basemap (no external tiles), port-to-port flows
routed over a curated maritime graph, Oil/Gas commodity toggle, ~260 mapped
infrastructure assets, 360+ trade flows, 10 chokepoints, 5 disruption scenarios.

## Quick Start

### 1. Start the backend + database

```bash
docker compose up -d
```

The backend container runs migrations, seeds the database, then starts uvicorn.

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

## Feature tour

- **Oil | Gas toggle** (header) — the whole map follows: flows, pipelines,
  infrastructure, choropleth metrics (Mt/yr vs bcm/yr)
- **Flows** — depart real export terminals and arrive at real import ports,
  routed along actual sea lanes through their chokepoints (Hormuz, Malacca,
  Suez…); pipeline trade follows the traced pipeline; particles show direction
- **Pipelines** — real traced routes (Druzhba, ESPO, CPC, Nord Stream…);
  gas dashed, offline greyed
- **Layers panel** (top-left) — per-type toggles with live counts; fields and
  labels appear as you zoom (level-of-detail)
- **Scenarios** (bottom bar) — run a disruption (e.g. Hormuz closure): affected
  flows freeze red, impact ranking appears
- **Search** (`/`) — countries, terminals, pipelines, fields, chokepoints
- **System Overview tab** — KPIs, top corridors, chokepoint risk board
- **ⓘ Data sources** — provenance table; curated 2024 demonstration dataset

## Architecture

```
backend/
  app/          FastAPI app (models, schemas, repositories, API routes)
  etl/          Data loaders (JsonLoader) + seed runner + validate_seeds
  scoring/      Pure scoring formulas + engine (oil-network scores)
  simulation/   NetworkX-based disruption engine (oil network)
  alembic/      DB migrations

frontend/
  src/
    api/        Axios client + SWR hooks + TypeScript types
    components/ Map layers (deck.gl), panels, charts, controls, overview
    config/     Feature flags
    store/      Zustand stores (map state, scenario state)
  public/geo/   Static GeoJSON (shipping lanes, container ports)
```

## Data

Curated demonstration dataset (2024 vintage) assembled from public sources:
Energy Institute Statistical Review, EIA, GIIGNL, Global Energy Monitor-style
trackers, with manually traced pipeline routes and shipping corridors. Each
record carries source attribution and a confidence level.

Validate seed files after editing:

```bash
docker compose run --rm backend python -m etl.validate_seeds
```

### Scaling up precision (free public sources)

The dataset can be upgraded to research-grade precision without paid feeds:

| What | Source (free) | How |
|---|---|---|
| Pipelines (exact routes), LNG terminals, fields | [Global Energy Monitor trackers](https://globalenergymonitor.org/projects/) (GOIT / GGIT / GOGET downloads) | `python -m etl.import_gem --pipelines gem.geojson --lng-terminals gem.csv --fields goget.csv` then validate + re-seed |
| Country oil balances | Energy Institute Statistical Review, JODI, EIA Open Data | drop normalized exports in `etl/sources/` and run `python -m etl.refresh --write-seed` |
| Bilateral crude flows | UN Comtrade (HS 2709) | same refresh pipeline (`comtrade.csv` in `etl/sources/`) |
| Live vessel positions | [aisstream.io](https://aisstream.io) (free API key) | the current "live sim" fleet derives from flow volumes; a real AIS websocket can replace `vesselFleet.ts` positions |

## Extending

- **New data source**: implement `DataLoader` in `backend/etl/loaders/` and pass it to `seed(loader=MyLoader())`
- **Refresh canonical crude data**: place normalized `energy_institute`, `jodi`, `eia`, and `comtrade` CSV/JSON exports under `backend/etl/sources/`, then run `docker compose run --rm backend python -m etl.refresh --write-seed`
- **New scenario**: add an entry to `backend/etl/data/scenarios.json` and re-seed
- **New pipeline**: add to `backend/etl/data/pipelines.json` with a `geometry` LineString, re-seed
- **New field / LNG terminal**: `fields.json` / `lng_terminals.json`, re-seed
- **Toggle a feature**: edit `frontend/src/config/features.ts`
- **New API field**: add column to model → new alembic revision → migrate
