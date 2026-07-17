# Real-Time AIS Vessels with Simulated Handoff — Design Spec

**Date:** 2026-07-05
**Status:** Approved by user (brainstorming session)
**Depends on:** existing frontend route engine (`flowGeometry.ts`, `searoutes.ts`, `vesselFleet.ts`), FastAPI backend.

## Goal

Show **real oil/gas tankers moving in real time** on the map using the free AISStream.io feed, and — when a real vessel leaves AIS coverage (open ocean) — **continue that same vessel with a realistic simulation** from its last known position toward its AIS-declared destination, reusing the app's existing maritime routing. Real vessels are the star; the current synthetic trade-flow fleet becomes an optional, clearly-labeled "simulated traffic" layer.

## Decisions (from brainstorming)

1. **Handoff model = per vessel.** The same physical vessel: real AIS while in coverage → simulated projection toward its declared destination while dark → back to real on reappearance. If the AIS destination can't be resolved, the vessel fades out gracefully instead of inventing a route.
2. **Existing simulated fleet = optional ambient traffic**, restyled as clearly synthetic, on its own toggle.
3. **Vessel scope = tankers (AIS ship type 80–89) + LNG carriers, global subscription** with backend throttling.
4. **Architecture = thin backend relay + smart frontend.** Backend relays filtered/throttled AIS state (incl. resolved destination coordinate); the frontend detects staleness and does the projection by reusing `searoutes.ts` / great-circle helpers. No maritime routing is re-implemented server-side.

## Non-Goals (YAGNI)

- No historical playback, no time travel.
- No database persistence of AIS data (in-memory only; lost on restart).
- No association of real AIS vessels to the app's country→country trade flows (real vessels are self-contained).
- No full UN/LOCODE database — a curated gazetteer of major petroleum ports; unresolved destinations fade.
- Satellite AIS (paid) is out; open-ocean gaps are expected and handled by the projection/fade.

## Global Constraints

- **Graceful degradation is mandatory:** with no `AISSTREAM_API_KEY` (or upstream unavailable), the backend AIS task does not start, `/api/v1/ais/status` reports `enabled:false`, the frontend hides the live layer, and the simulated fleet carries the map. A fresh clone with no key must run unchanged.
- Reuse the existing route engine (`searoutes.nearestSeaNode`/`seaRouteVia`, `flowGeometry` great-circle + unwrap helpers) for projection — do not port routing to Python.
- deck.gl rules preserved on the new layer: `parameters: globeParams(globe)`, hemisphere culling (`pointVisibleOnGlobe`), invisible `ScatterplotLayer` hit-target for icons.
- AIS animation is driven by **wall-clock time** (`Date.now()` / elapsed seconds), decoupled from the shared 60 s animation clock — the integer-clock-multiplier rule does not apply here.
- Colors from theme modules only: map RGBA from `mapTheme.ts`, UI hex from `uiTheme.ts`. No raw hex in components.
- API key lives **only** on the backend; never sent to the browser.
- Commits: the user is the sole author; do not add co-author trailers.

## Architecture

```
AISStream WS ──► backend/app/ais/client.py
                      │ (PositionReport + ShipStaticData)
                      ▼
                 registry.py  ──uses──► ports.py (destination → lon/lat)
                      │ (tanker/LNG only, joined state per MMSI)
                      ▼
                 broadcast.py ──► WS /api/v1/ais/stream ──► frontend useAisVessels.ts
                      │                                          │ Map<mmsi, LiveVessel>
                 GET /api/v1/ais/status                          ▼
                                                    aisVessel.ts (live│projected│faded)
                                                                 │ (reuses searoutes/great-circle)
                                                                 ▼
                                                    AisVesselLayer.tsx (deck.gl)
```

## Backend — new module `backend/app/ais/`

**`client.py`** — async AISStream consumer.
- Connects to `wss://stream.aisstream.io/v0/stream`; on open sends the subscription: API key, global bounding box, `FilterMessageTypes: ["PositionReport", "ShipStaticData"]`. (Exact bounding-box coordinate ordering and field names confirmed against the AISStream docs during implementation.)
- Reconnects with exponential backoff; never propagates upstream failures to FastAPI.
- Passes each decoded message to the registry.

**`registry.py`** — `VesselRegistry`, in-memory `dict[int, VesselState]` keyed by MMSI.
- On `ShipStaticData`: cache `name`, `ship_type` (int), raw `destination`, `eta`; compute `is_tanker = 80 <= ship_type <= 89` (LNG carriers included — may also appear as tanker); resolve `dest_coord = ports.resolve_destination(destination)`.
- On `PositionReport`: update `lon, lat, sog, cog, heading, last_seen`. **Only forward vessels already known to be tanker/LNG** (static seen first); positions for unknown-type MMSIs are buffered briefly or dropped.
- Exposes `snapshot()` (all current tanker vessels) and `changed_since(ts)` for the broadcaster.
- Prunes vessels not seen for a long window (e.g. 30 min).

**`ports.py`** — curated gazetteer of ~150 major petroleum ports.
- Data: UN/LOCODE and common name → `(lon, lat)`. Ships as a Python dict (or bundled JSON) — curated, matching the project's "curated dataset" philosophy.
- `resolve_destination(text: str | None) -> tuple[float, float] | None`: normalize (strip/upper), try exact LOCODE, then contains-name match; return `None` if unresolved.

**`broadcast.py`** — connection manager for frontend WS clients.
- On client connect: send full `snapshot`. Then a throttled loop emits per-vessel updates at most every `AIS_THROTTLE_SECONDS` (~3 s).
- Compact payload per vessel: `{mmsi, name, type, lon, lat, sog, cog, heading, dest: [lon,lat] | null, dest_name, ts}`.

**`router.py`** — `APIRouter`:
- `WS /api/v1/ais/stream` — snapshot then deltas.
- `GET /api/v1/ais/status` — `{enabled: bool, connected: bool, vessel_count: int}`.

**Wiring**
- `main.py`: FastAPI lifespan starts the AIS client + broadcaster background task **only if** `settings.aisstream_api_key`. Include `ais` router.
- `config.py`: add `aisstream_api_key: str | None = None`, `ais_throttle_seconds: float = 3.0`.
- WS origin/CORS: allow the same dev origins as REST.

## Frontend

**`api/hooks/useAisVessels.ts`**
- Opens a WebSocket to the AIS stream (WS base derived from the REST base in `client.ts`). Maintains `Map<number, LiveVessel>` in a ref/store; applies snapshot + deltas; reconnects with backoff. Fetches `/api/v1/ais/status` once to know if live data is enabled. Returns `{ vessels, status }`.

**`components/Map/aisVessel.ts`** — pure, unit-tested handoff engine.
- Types:
  ```ts
  interface LiveVessel {
    mmsi: number; name: string; type: number
    lon: number; lat: number; sog: number; cog: number; heading: number | null
    dest: [number, number] | null; destName: string | null
    lastSeenMs: number; firstSeenPos: [number, number]
  }
  type VesselMode = 'live' | 'projected' | 'faded'
  interface VesselDisplay { mode: VesselMode; position: [number, number]; bearing: number; opacity: number }
  ```
- `vesselDisplayState(v: LiveVessel, nowMs: number): VesselDisplay`:
  - `nowMs - v.lastSeenMs < LIVE_TTL_MS` (≈ 90 s) → `live`: position = last pos, bearing = heading ?? cog, opacity 1.
  - else if `v.dest` resolved → `projected`: build a route `lastPos → dest` (once, memoized by `mmsi|dest`) via `nearestSeaNode`/`seaRouteVia` + great-circle interpolation (reuse `flowGeometry` helpers, extracted/shared as needed); advance along it by `elapsedSeconds × sog` (nm→deg); opacity ≈ 0.6; bearing from the route tangent.
  - else → `faded`: opacity ramps 1→0 across `DARK_TTL_MS` (≈ 6 min) past `LIVE_TTL`; caller removes at 0.
- Constants `LIVE_TTL_MS`, `DARK_TTL_MS`, projection speed conversion are module constants.

**`components/Map/AisVesselLayer.tsx`**
- deck.gl `IconLayer` over the live vessel map, driven by an animation tick (reuse the existing rAF `animTime` clock in `WorldMap`, but compute display state from `Date.now()`).
- Live vessels: solid commodity/neutral accent + subtle "LIVE" ring; projected: same glyph, reduced opacity + dashed wake `PathLayer`; faded: opacity from engine.
- Invisible `ScatterplotLayer` hit-target; `parameters: globeParams(globe)`; hemisphere culling. Tooltip: real name, type label, speed (kn), destination name, and mode ("live AIS" / "projected · sim").

**Existing `components/Map/VesselLayer.tsx`** → "simulated traffic" layer.
- Restyled to read as synthetic (ghosted/hollow), gated behind its toggle.

**Store & controls**
- `mapStore.ts`: add layer key `aisLive` (default **on**); keep `vessels` as the simulated-traffic toggle (default **on**, restyled). Both independent.
- `LayersPanel.tsx`: new row "Live tankers (AIS)" with a connection dot (green when `status.connected`, grey when disabled/offline); rename the existing vessels row to "Simulated traffic."
- `MapLegend.tsx`: reflect both.
- `WorldMap.tsx`: instantiate `AisVesselLayer` from `useAisVessels`; keep `VesselLayer` behind its toggle.
- WS base helper in `api/client.ts` (derive `ws(s)://host` from the REST base URL).

## Data Flow & Handoff Lifecycle

1. Backend joins `ShipStaticData` (type, name, destination→coord) with `PositionReport` (pos, speed, course) per MMSI; forwards only tankers/LNG, throttled.
2. Frontend stores `LiveVessel` per MMSI; each frame computes `vesselDisplayState(v, Date.now())`.
3. Fresh message → **live** (real position). No message > `LIVE_TTL` → **projected** toward `dest` along a sea route (or **faded** if no `dest`). New live message → back to **live**.
4. No key / disconnected → live layer hidden; simulated traffic remains.

## Error Handling / Reliability

- Backend: AISStream reconnect with backoff; task guarded so FastAPI never crashes on upstream errors; task not started without a key.
- Frontend: WS reconnect with backoff; if never connects, silently fall back to simulated traffic; prune vessels unseen > `DARK_TTL`; project only with a resolved destination.

## Testing

- **Backend (pytest — new `backend/tests/`):**
  - `ports.resolve_destination`: LOCODE hit, name-contains hit, blank/garbage → `None`.
  - `registry`: static-then-position join; tanker filter (type 80–89 kept, others dropped); position-before-static buffering; prune.
  - `broadcast` throttle: emits a given MMSI at most once per interval (with a fake clock).
- **Frontend (vitest):** `aisVessel.vesselDisplayState`:
  - fresh → `live` at real pos; stale + dest → `projected` advancing along the route over time; stale + no dest → `faded` ramping to 0; reappearance → `live`; bearing correctness.

## File Structure

```
backend/app/ais/__init__.py
backend/app/ais/client.py        AISStream WS consumer (+ backoff)
backend/app/ais/registry.py      in-memory MMSI state, tanker filter, static/position join
backend/app/ais/ports.py         curated destination gazetteer + resolver
backend/app/ais/broadcast.py     frontend WS client manager + throttled emitter
backend/app/ais/router.py        WS /ais/stream + GET /ais/status
backend/app/config.py            + aisstream_api_key, ais_throttle_seconds  (modify)
backend/app/main.py              lifespan starts AIS task if key set; include router  (modify)
backend/tests/test_ports.py
backend/tests/test_registry.py

frontend/src/api/hooks/useAisVessels.ts    WS client + live vessel store
frontend/src/api/client.ts                 + wsBase() helper  (modify)
frontend/src/components/Map/aisVessel.ts   handoff/projection engine (pure)
frontend/src/components/Map/aisVessel.test.ts
frontend/src/components/Map/AisVesselLayer.tsx
frontend/src/components/Map/VesselLayer.tsx   restyle → simulated traffic  (modify)
frontend/src/components/Map/WorldMap.tsx      wire AIS layer + status  (modify)
frontend/src/store/mapStore.ts                + aisLive layer key  (modify)
frontend/src/components/Controls/LayersPanel.tsx   row + connection dot  (modify)
frontend/src/components/Map/MapLegend.tsx     labels  (modify)
```

## Acceptance

- With a valid `AISSTREAM_API_KEY`: real tankers appear and move near coasts/chokepoints; a vessel going dark continues along a route to its declared destination (or fades if unknown) and snaps back to live on reappearance; live/projected are visually distinguishable; tooltip shows real identity + mode.
- Without a key: app runs exactly as today (simulated traffic only), no errors, `ais/status.enabled=false`.
- Backend and frontend unit tests pass; `npm run build` clean; no raw hex outside theme files.
