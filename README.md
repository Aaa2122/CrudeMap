# CrudeMap

**An interactive intelligence map of the world's oil & gas system.**

Trade flows sail real maritime routes between real export and import terminals,
pipelines follow their actual traced paths, a simulated tanker fleet moves live
across the map — all rendered on a fully custom GIS basemap with zero external
tile dependencies.

![CrudeMap — world crude oil network](docs/screenshots/oil-world.png)

## Highlights

🛢️ **Two commodities, one switch** — toggle between the crude oil network and
the natural gas network (LNG + pipeline gas). Flows, infrastructure, metrics
and units (Mt/yr ↔ bcm/yr) all follow.

🗺️ **Port-to-port flows on real sea lanes** — every seaborne flow departs the
source country's actual export terminal and docks at the target's import port,
routed with Dijkstra over a curated maritime graph through its real
chokepoints (Hormuz, Malacca, Suez, Bab el-Mandeb, Panama, the Cape…).
Russia ships to Asia from Sakhalin and to Europe from the Baltic — the
departure terminal is picked by destination. Pipeline trade rides the traced
pipeline geometry instead.

🚢 **Live tanker fleet (simulated)** — named vessels (VLCCs, Suezmaxes, LNG
carriers) with tonnage and cargo sail the routes continuously, oriented by
heading, hoverable for voyage details.

🌍 **Custom GIS basemap** — ocean, graticule, continents and borders are
rendered in-app from GeoJSON. No OSM, no tile server, full visual control —
including a tile-free globe mode.

🎨 **Country choropleth = net balance** — countries are colored by
production − consumption: net exporters glow in the commodity hue, net
importers in steel blue. Who pumps and who burns, at a glance.

⚓ **~260 mapped assets** — export/import terminals, refineries, LNG
liquefaction/regas terminals, 70+ producing fields (Ghawar, Permian, North
Field…), 39 pipelines with real traces (Druzhba, ESPO, Nord Stream…), 10
chokepoints with risk levels, plus optional container shipping corridors.

| Natural gas network | Strait of Hormuz detail |
|---|---|
| ![Gas network](docs/screenshots/gas-world.png) | ![Hormuz detail](docs/screenshots/gulf-detail.png) |

| Tile-free globe | System overview |
|---|---|
| ![Globe](docs/screenshots/globe.png) | ![Overview](docs/screenshots/overview.png) |

## Quick start

Requires Docker + Node 20.

```bash
# 1. Database + API (runs migrations and seeds automatically)
docker compose up -d

# 2. Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```


## Using the map

- **Oil | Gas** (header) — switch the whole network
- **Choropleth metric** — selector inside the bottom-left legend (net balance,
  production, consumption, imports, exports, refining, dependency)
- **Layers** (top-left) — per-type toggles with live counts; fields and labels
  appear as you zoom (level-of-detail)
- **Search** (`/`) — countries, terminals, pipelines, fields, chokepoints;
  selecting flies the camera and opens the detail panel
- **Click anything** — countries, terminals, fields, pipelines and chokepoints
  open panels with balances, vulnerability bars, suppliers, route exposure and
  per-record source attribution
- **Flat / Globe** — same fully custom rendering in both projections

## Architecture

```
backend/                    Python 3.11 · FastAPI · PostgreSQL
  app/                      models, schemas, repositories, API routes
  etl/                      seed runner, JSON loaders, validate_seeds,
                            refresh pipeline (EI/JODI/EIA/Comtrade),
                            import_gem (Global Energy Monitor converter)
  scoring/                  dependency / HHI / resilience formulas
  simulation/               NetworkX disruption engine (dormant endpoints)

frontend/                   React 18 · TypeScript · deck.gl 9 · Tailwind
  src/components/Map/       custom GIS basemap, choropleth, flows + particles,
                            vessel fleet, pipelines, fields, infra icons,
                            maritime routing graph (searoutes.ts)
  src/components/           controls, panels, overview dashboard
  public/geo/               static GeoJSON (shipping lanes, container ports)
```

Notable engineering details:

- **Maritime routing graph** ([searoutes.ts](frontend/src/components/Map/searoutes.ts)) —
  ~80 hand-placed sea nodes and corridor edges; flows are routed with Dijkstra
  and forced through their chokepoints, so real shipping lanes emerge visually
  from overlapping routes
- **Globe rendering** ([globeCulling.ts](frontend/src/components/Map/globeCulling.ts)) —
  data layers paint in order with JS hemisphere culling, sidestepping depth
  artifacts from coarse polygons on the sphere
- **Antimeridian-safe geometry** — transpacific routes use unwrapped
  longitudes, no seam artifacts in either projection

## Data

Curated demonstration dataset (2024 vintage) assembled from public sources —
Energy Institute Statistical Review, EIA, GIIGNL, Global Energy Monitor-style
trackers — with manually traced pipeline routes and shipping corridors. Every
record carries a source attribution and confidence level (ⓘ in the header
lists them all).

Validate seeds after editing:

```bash
docker compose run --rm backend python -m etl.validate_seeds
```

### Scaling up precision (free public sources)

| What | Source (free) | How |
|---|---|---|
| Pipelines (exact routes), LNG terminals, fields | [Global Energy Monitor trackers](https://globalenergymonitor.org/projects/) | `python -m etl.import_gem --pipelines gem.geojson --lng-terminals gem.csv --fields goget.csv`, then validate + re-seed |
| Country oil balances | Energy Institute, JODI, EIA Open Data | drop normalized exports in `etl/sources/`, run `python -m etl.refresh --write-seed` |
| Bilateral crude flows | UN Comtrade (HS 2709) | same refresh pipeline (`comtrade.csv` in `etl/sources/`) |
| Live vessel positions | [aisstream.io](https://aisstream.io) (free key) | swap the simulated positions in `vesselFleet.ts` for an AIS websocket |

## Extending

- **New pipeline** — add to `backend/etl/data/pipelines.json` with a
  `geometry` LineString, re-seed
- **New field / LNG terminal** — `fields.json` / `lng_terminals.json`, re-seed
- **New data source** — implement `DataLoader` in `backend/etl/loaders/`
- **Feature flags** — `frontend/src/config/features.ts`
