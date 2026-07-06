# Real-Time AIS Vessels with Simulated Handoff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream real oil/gas tankers from AISStream.io onto the map, and continue each vessel with a realistic route-to-destination simulation when it leaves AIS coverage — reusing the existing maritime routing engine.

**Architecture:** Thin FastAPI backend relay (`backend/app/ais/`) connects to AISStream, filters tankers/LNG, resolves declared destinations to coordinates, and pushes throttled state over a WebSocket. A smart frontend (`aisVessel.ts` + `AisVesselLayer.tsx`) renders live positions and, on staleness, projects vessels along `searoutes.ts` routes. The existing synthetic fleet becomes an optional "simulated traffic" layer.

**Tech Stack:** FastAPI 0.111 (WebSocket + lifespan), Python `websockets`, pytest/pytest-asyncio, React 18, deck.gl 9, vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-realtime-ais-vessels-design.md`.

## Global Constraints

- **Graceful degradation is mandatory:** no `AISSTREAM_API_KEY` ⇒ backend AIS task doesn't start, `/api/v1/ais/status` returns `enabled:false`, frontend hides the live layer, simulated traffic carries the map. A fresh clone with no key runs unchanged.
- Reuse `searoutes.nearestSeaNode` / `seaRouteVia` for projection routes — no maritime routing in Python.
- AIS animation uses wall-clock time (`Date.now()`), decoupled from the shared 60 s clock (integer-multiplier rule N/A here).
- deck.gl: new layer keeps `parameters: globeParams(globe)`, hemisphere culling (`pointVisibleOnGlobe`), invisible `ScatterplotLayer` hit-target.
- Colors from theme modules only (`mapTheme.ts` RGBA, `uiTheme.ts` hex). No raw hex in components.
- API key lives only on the backend; never sent to the browser.
- **Commits: user is the sole author. Do NOT add any `Co-Authored-By` trailer.**
- Backend tests run in the container: `docker compose run --rm backend python -m pytest tests/ -v`. Frontend: `npx vitest run` from `frontend/`. `npm run build` must stay green.
- Work on branch `feat/realtime-ais-vessels` (already created).

## AISStream message shapes (reference for Task 4)

Position: `{"MessageType":"PositionReport","MetaData":{"MMSI":123,"time_utc":"..."},"Message":{"PositionReport":{"Latitude":59.1,"Longitude":10.2,"Sog":12.1,"Cog":245.5,"TrueHeading":244}}}`
Static: `{"MessageType":"ShipStaticData","MetaData":{"MMSI":123},"Message":{"ShipStaticData":{"Name":"NORDIC X","Destination":"NLRTM","Type":80}}}`
Subscribe (sent on open): `{"APIKey":"<key>","BoundingBoxes":[[[-90,-180],[90,180]]],"FilterMessageTypes":["PositionReport","ShipStaticData"]}`

---

### Task 1: Backend deps, config, port gazetteer

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Modify: `backend/app/config.py`
- Create: `backend/app/ais/__init__.py` (empty)
- Create: `backend/app/ais/ports.py`
- Create: `backend/tests/__init__.py` (empty, if missing)
- Test: `backend/tests/test_ports.py`

**Interfaces:**
- Produces: `resolve_destination(text: str | None) -> tuple[float, float] | None` (lon, lat); `settings.aisstream_api_key: str | None`, `settings.ais_throttle_seconds: float`.

- [ ] **Step 1: Add dependencies**

Append to `backend/requirements.txt`:

```
websockets==12.0
pytest==8.2.0
pytest-asyncio==0.23.7
```

- [ ] **Step 2: Pytest config**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 3: Config fields**

In `backend/app/config.py`, add two fields inside `Settings` (after `etl_loader`):

```python
    aisstream_api_key: str | None = None
    ais_throttle_seconds: float = 3.0
```

- [ ] **Step 4: Write the failing test** — `backend/tests/test_ports.py`:

```python
from app.ais.ports import resolve_destination


def test_resolves_locode():
    assert resolve_destination("NLRTM") == (4.1, 51.95)  # Rotterdam


def test_resolves_by_name_contains():
    coord = resolve_destination("FOR ORDERS ROTTERDAM")
    assert coord == (4.1, 51.95)


def test_blank_and_garbage_return_none():
    assert resolve_destination("") is None
    assert resolve_destination(None) is None
    assert resolve_destination("ZZZZZ") is None
```

- [ ] **Step 5: Run to verify it fails**

Run: `docker compose build backend && docker compose run --rm backend python -m pytest tests/test_ports.py -v`
Expected: FAIL (module `app.ais.ports` missing).

- [ ] **Step 6: Implement `backend/app/ais/ports.py`**

```python
"""Curated gazetteer of major petroleum ports.

Maps UN/LOCODEs and common port names to (lon, lat). Deliberately small and
curated — unresolved destinations return None so the frontend fades the
vessel instead of inventing a route.
"""
from __future__ import annotations

# (lon, lat) — a compact set of the busiest crude/product/LNG ports.
_PORTS: dict[str, tuple[float, float]] = {
    "NLRTM": (4.10, 51.95),   # Rotterdam
    "SGSIN": (103.85, 1.26),  # Singapore
    "CNSHA": (121.80, 31.05), # Shanghai
    "CNNGB": (121.85, 29.87), # Ningbo
    "AEFJR": (56.35, 25.13),  # Fujairah
    "AEJEA": (55.03, 24.98),  # Jebel Ali
    "SAJUB": (49.66, 27.02),  # Jubail
    "SARAB": (49.58, 27.48),  # Ras Tanura
    "USHOU": (-95.05, 29.62), # Houston
    "USLOOP": (-90.02, 28.88),# LOOP (Louisiana)
    "KRYOS": (129.38, 35.10), # Yeosu / Ulsan area
    "JPCHB": (140.05, 35.55), # Chiba
    "INJAM": (69.72, 22.35),  # Sikka/Jamnagar
    "EGSUZ": (32.55, 29.93),  # Suez
    "RUPRI": (34.78, 44.62),  # Primorsk (approx)
    "RUNVS": (37.80, 44.72),  # Novorossiysk
    "TRCEY": (35.90, 36.88),  # Ceyhan
    "DZARZ": (0.30, 35.85),   # Arzew (LNG)
    "QARLF": (51.55, 25.90),  # Ras Laffan (LNG)
    "AUKAR": (116.13, -20.58),# Karratha (NW Shelf LNG)
    "USSAB": (-93.87, 29.73), # Sabine Pass (LNG)
    "GBMLF": (-5.05, 51.70),  # Milford Haven
    "BEZEE": (3.20, 51.35),   # Zeebrugge (LNG)
    "FRFOS": (4.90, 43.42),   # Fos-sur-Mer
    "MYPKG": (101.35, 3.00),  # Port Klang
    "NGBON": (7.17, 4.45),    # Bonny (LNG)
}

# Common name fragments → LOCODE (checked with `in`, longest first).
_NAME_TO_CODE: dict[str, str] = {
    "ROTTERDAM": "NLRTM", "SINGAPORE": "SGSIN", "SHANGHAI": "CNSHA",
    "NINGBO": "CNNGB", "FUJAIRAH": "AEFJR", "JEBEL ALI": "AEJEA",
    "JUBAIL": "SAJUB", "RAS TANURA": "SARAB", "HOUSTON": "USHOU",
    "LOOP": "USLOOP", "YEOSU": "KRYOS", "ULSAN": "KRYOS", "CHIBA": "JPCHB",
    "JAMNAGAR": "INJAM", "SIKKA": "INJAM", "SUEZ": "EGSUZ",
    "PRIMORSK": "RUPRI", "NOVOROSSIYSK": "RUNVS", "CEYHAN": "TRCEY",
    "ARZEW": "DZARZ", "RAS LAFFAN": "QARLF", "KARRATHA": "AUKAR",
    "SABINE": "USSAB", "MILFORD": "GBMLF", "ZEEBRUGGE": "BEZEE",
    "FOS": "FRFOS", "PORT KLANG": "MYPKG", "BONNY": "NGBON",
}


def resolve_destination(text: str | None) -> tuple[float, float] | None:
    if not text:
        return None
    key = text.strip().upper()
    if not key:
        return None
    if key in _PORTS:
        return _PORTS[key]
    for fragment in sorted(_NAME_TO_CODE, key=len, reverse=True):
        if fragment in key:
            return _PORTS[_NAME_TO_CODE[fragment]]
    return None
```

- [ ] **Step 7: Run tests + commit**

Run: `docker compose run --rm backend python -m pytest tests/test_ports.py -v` → PASS.

```bash
git add backend/requirements.txt backend/pytest.ini backend/app/config.py backend/app/ais/__init__.py backend/app/ais/ports.py backend/tests/test_ports.py backend/tests/__init__.py
git commit -m "feat(ais): backend deps, config, curated port gazetteer"
```

---

### Task 2: Vessel registry (static/position join + tanker filter)

**Files:**
- Create: `backend/app/ais/registry.py`
- Test: `backend/tests/test_registry.py`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (dest coord is passed in by the caller).
- Produces:
  - `@dataclass VesselState` with fields `mmsi:int, name:str|None, ship_type:int|None, is_tanker:bool|None, lon:float|None, lat:float|None, sog:float, cog:float, heading:int|None, dest:tuple[float,float]|None, dest_name:str|None, last_seen_ms:float`.
  - `class VesselRegistry` with `apply_position(mmsi, lon, lat, sog, cog, heading, seen_ms)`, `apply_static(mmsi, name, ship_type, dest, dest_name)`, `tanker_states() -> list[VesselState]`, `prune(now_ms, ttl_ms)`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_registry.py`:

```python
from app.ais.registry import VesselRegistry


def test_position_then_tanker_static_makes_it_visible():
    r = VesselRegistry()
    r.apply_position(1, 10.0, 59.0, 12.0, 200.0, 199, seen_ms=1000)
    assert r.tanker_states() == []  # type unknown yet
    r.apply_static(1, "NORDIC X", 80, dest=(4.1, 51.95), dest_name="Rotterdam")
    states = r.tanker_states()
    assert len(states) == 1 and states[0].name == "NORDIC X"
    assert states[0].dest == (4.1, 51.95)


def test_non_tanker_is_filtered_out():
    r = VesselRegistry()
    r.apply_position(2, 1.0, 1.0, 5.0, 90.0, 90, seen_ms=1000)
    r.apply_static(2, "BOXBOAT", 70, dest=None, dest_name=None)  # cargo
    assert r.tanker_states() == []


def test_prune_drops_stale():
    r = VesselRegistry()
    r.apply_position(3, 1.0, 1.0, 5.0, 90.0, 90, seen_ms=1000)
    r.apply_static(3, "OLD TANKER", 84, dest=None, dest_name=None)
    r.prune(now_ms=1000 + 2_000_000, ttl_ms=1_800_000)
    assert r.tanker_states() == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm backend python -m pytest tests/test_registry.py -v` → FAIL (module missing).

- [ ] **Step 3: Implement `backend/app/ais/registry.py`**

```python
"""In-memory registry joining AIS static + position messages per MMSI.

Only tankers/LNG (ship type 80-89) are ever emitted. Positions arriving
before static data are retained (type unknown) and become visible once the
static message confirms a tanker.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class VesselState:
    mmsi: int
    name: str | None = None
    ship_type: int | None = None
    is_tanker: bool | None = None
    lon: float | None = None
    lat: float | None = None
    sog: float = 0.0
    cog: float = 0.0
    heading: int | None = None
    dest: tuple[float, float] | None = None
    dest_name: str | None = None
    last_seen_ms: float = 0.0


class VesselRegistry:
    def __init__(self) -> None:
        self._states: dict[int, VesselState] = {}

    def _get(self, mmsi: int) -> VesselState:
        state = self._states.get(mmsi)
        if state is None:
            state = VesselState(mmsi=mmsi)
            self._states[mmsi] = state
        return state

    def apply_position(
        self, mmsi: int, lon: float, lat: float, sog: float, cog: float,
        heading: int | None, seen_ms: float,
    ) -> None:
        s = self._get(mmsi)
        s.lon, s.lat, s.sog, s.cog, s.heading = lon, lat, sog, cog, heading
        s.last_seen_ms = seen_ms

    def apply_static(
        self, mmsi: int, name: str | None, ship_type: int | None,
        dest: tuple[float, float] | None, dest_name: str | None,
    ) -> None:
        s = self._get(mmsi)
        s.name = name or s.name
        s.ship_type = ship_type
        s.is_tanker = ship_type is not None and 80 <= ship_type <= 89
        s.dest = dest
        s.dest_name = dest_name

    def tanker_states(self) -> list[VesselState]:
        return [
            s for s in self._states.values()
            if s.is_tanker and s.lon is not None and s.lat is not None
        ]

    def prune(self, now_ms: float, ttl_ms: float) -> None:
        stale = [m for m, s in self._states.items() if now_ms - s.last_seen_ms > ttl_ms]
        for m in stale:
            del self._states[m]
```

- [ ] **Step 4: Run tests + commit**

Run: `docker compose run --rm backend python -m pytest tests/test_registry.py -v` → PASS.

```bash
git add backend/app/ais/registry.py backend/tests/test_registry.py
git commit -m "feat(ais): vessel registry with static/position join and tanker filter"
```

---

### Task 3: Payload serialization + throttled selection

**Files:**
- Create: `backend/app/ais/broadcast.py` (selection + payload helpers this task; WS hub added in Task 5)
- Test: `backend/tests/test_broadcast.py`

**Interfaces:**
- Consumes: `VesselState` (Task 2).
- Produces:
  - `vessel_payload(s: VesselState) -> dict` → `{mmsi,name,type,lon,lat,sog,cog,heading,dest,dest_name,ts}`.
  - `select_due(states, last_emit, now_ms, interval_ms) -> list[VesselState]` — returns states not emitted within `interval_ms`, and mutates `last_emit` (dict mmsi→ms) for those returned.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_broadcast.py`:

```python
from app.ais.broadcast import select_due, vessel_payload
from app.ais.registry import VesselState


def _tanker(mmsi, seen):
    return VesselState(mmsi=mmsi, name="T", ship_type=80, is_tanker=True,
                       lon=1.0, lat=2.0, sog=10.0, cog=90.0, heading=90,
                       dest=(4.1, 51.95), dest_name="Rotterdam", last_seen_ms=seen)


def test_payload_shape():
    p = vessel_payload(_tanker(1, 1000))
    assert p == {"mmsi": 1, "name": "T", "type": 80, "lon": 1.0, "lat": 2.0,
                 "sog": 10.0, "cog": 90.0, "heading": 90,
                 "dest": [4.1, 51.95], "dest_name": "Rotterdam", "ts": 1000}


def test_select_due_throttles_per_mmsi():
    last: dict[int, float] = {}
    states = [_tanker(1, 0)]
    assert len(select_due(states, last, now_ms=0, interval_ms=3000)) == 1     # first time
    assert select_due(states, last, now_ms=1000, interval_ms=3000) == []      # too soon
    assert len(select_due(states, last, now_ms=3500, interval_ms=3000)) == 1  # interval passed
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm backend python -m pytest tests/test_broadcast.py -v` → FAIL.

- [ ] **Step 3: Implement `backend/app/ais/broadcast.py`**

```python
"""Frontend-facing payloads + per-vessel throttling.

The WS hub (Task 5) uses these helpers; keeping them pure makes throttling
and serialization unit-testable without sockets.
"""
from __future__ import annotations

from app.ais.registry import VesselState


def vessel_payload(s: VesselState) -> dict:
    return {
        "mmsi": s.mmsi,
        "name": s.name,
        "type": s.ship_type,
        "lon": s.lon,
        "lat": s.lat,
        "sog": s.sog,
        "cog": s.cog,
        "heading": s.heading,
        "dest": [s.dest[0], s.dest[1]] if s.dest else None,
        "dest_name": s.dest_name,
        "ts": s.last_seen_ms,
    }


def select_due(
    states: list[VesselState], last_emit: dict[int, float],
    now_ms: float, interval_ms: float,
) -> list[VesselState]:
    due: list[VesselState] = []
    for s in states:
        prev = last_emit.get(s.mmsi)
        if prev is None or now_ms - prev >= interval_ms:
            last_emit[s.mmsi] = now_ms
            due.append(s)
    return due
```

- [ ] **Step 4: Run tests + commit**

Run: `docker compose run --rm backend python -m pytest tests/test_broadcast.py -v` → PASS.

```bash
git add backend/app/ais/broadcast.py backend/tests/test_broadcast.py
git commit -m "feat(ais): vessel payload serialization and per-mmsi throttle"
```

---

### Task 4: AISStream message decode + client loop

**Files:**
- Create: `backend/app/ais/client.py`
- Test: `backend/tests/test_client_decode.py`

**Interfaces:**
- Consumes: `VesselRegistry` (Task 2), `resolve_destination` (Task 1).
- Produces:
  - `dispatch_message(raw: dict, registry: VesselRegistry, now_ms: float) -> None` — decodes one AISStream message into registry updates.
  - `async def run_ais_client(registry, api_key, stop_event)` — connect loop with backoff (thin glue, not unit-tested).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_client_decode.py`:

```python
from app.ais.client import dispatch_message
from app.ais.registry import VesselRegistry


def test_decodes_position_then_static():
    r = VesselRegistry()
    dispatch_message({
        "MessageType": "PositionReport",
        "MetaData": {"MMSI": 42},
        "Message": {"PositionReport": {"Latitude": 59.0, "Longitude": 10.0,
                                        "Sog": 12.0, "Cog": 210.0, "TrueHeading": 208}},
    }, r, now_ms=5000)
    dispatch_message({
        "MessageType": "ShipStaticData",
        "MetaData": {"MMSI": 42},
        "Message": {"ShipStaticData": {"Name": "STAR", "Type": 80, "Destination": "NLRTM"}},
    }, r, now_ms=5000)
    states = r.tanker_states()
    assert len(states) == 1
    s = states[0]
    assert (round(s.lon, 3), round(s.lat, 3)) == (10.0, 59.0)
    assert s.dest == (4.1, 51.95) and s.dest_name == "NLRTM"


def test_unknown_message_type_is_ignored():
    r = VesselRegistry()
    dispatch_message({"MessageType": "Weather", "MetaData": {"MMSI": 9}, "Message": {}}, r, now_ms=1)
    assert r.tanker_states() == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm backend python -m pytest tests/test_client_decode.py -v` → FAIL.

- [ ] **Step 3: Implement `backend/app/ais/client.py`**

```python
"""AISStream.io WebSocket consumer.

`dispatch_message` (pure) decodes one message into the registry.
`run_ais_client` is the reconnecting I/O loop, started from the app lifespan
only when an API key is configured.
"""
from __future__ import annotations

import asyncio
import json

import websockets

from app.ais.ports import resolve_destination
from app.ais.registry import VesselRegistry

AIS_WS_URL = "wss://stream.aisstream.io/v0/stream"
_SUBSCRIBE = {
    "BoundingBoxes": [[[-90, -180], [90, 180]]],
    "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
}


def dispatch_message(raw: dict, registry: VesselRegistry, now_ms: float) -> None:
    kind = raw.get("MessageType")
    mmsi = (raw.get("MetaData") or {}).get("MMSI")
    if mmsi is None:
        return
    body = (raw.get("Message") or {}).get(kind) or {}
    if kind == "PositionReport":
        lat, lon = body.get("Latitude"), body.get("Longitude")
        if lat is None or lon is None:
            return
        registry.apply_position(
            mmsi, lon, lat,
            float(body.get("Sog") or 0.0), float(body.get("Cog") or 0.0),
            body.get("TrueHeading"), now_ms,
        )
    elif kind == "ShipStaticData":
        dest_text = body.get("Destination")
        registry.apply_static(
            mmsi, body.get("Name"), body.get("Type"),
            resolve_destination(dest_text), (dest_text or None),
        )


async def run_ais_client(registry: VesselRegistry, api_key: str, stop: asyncio.Event) -> None:
    backoff = 1.0
    while not stop.is_set():
        try:
            async with websockets.connect(AIS_WS_URL, ping_interval=20) as ws:
                await ws.send(json.dumps({"APIKey": api_key, **_SUBSCRIBE}))
                backoff = 1.0
                async for message in ws:
                    now_ms = asyncio.get_event_loop().time() * 1000
                    try:
                        dispatch_message(json.loads(message), registry, now_ms)
                    except (ValueError, KeyError):
                        continue
                    if stop.is_set():
                        break
        except Exception:  # noqa: BLE001 — never let upstream kill the app
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
```

Note: `dest_name` stores the raw declared destination text (e.g. "NLRTM") for the tooltip; resolution to coordinates is separate.

- [ ] **Step 4: Run tests + commit**

Run: `docker compose run --rm backend python -m pytest tests/test_client_decode.py -v` → PASS.

```bash
git add backend/app/ais/client.py backend/tests/test_client_decode.py
git commit -m "feat(ais): AISStream message decode and reconnecting client loop"
```

---

### Task 5: WS hub, router, lifespan wiring, /ais/status

**Files:**
- Create: `backend/app/ais/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_status_endpoint.py`

**Interfaces:**
- Consumes: `VesselRegistry`, `select_due`, `vessel_payload`, `run_ais_client`, `settings`.
- Produces: `AisHub` (holds registry, clients, emitter loop); `router` with `WS /ais/stream` + `GET /ais/status`; app state `app.state.ais_hub`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_status_endpoint.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_status_disabled_without_key():
    with TestClient(app) as client:
        res = client.get("/api/v1/ais/status")
        assert res.status_code == 200
        body = res.json()
        assert body["enabled"] is False
        assert body["vessel_count"] == 0
```

(No `AISSTREAM_API_KEY` in the test environment ⇒ `enabled:false`.)

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm backend python -m pytest tests/test_status_endpoint.py -v` → FAIL (route missing).

- [ ] **Step 3: Implement `backend/app/ais/router.py`**

```python
"""WS hub + status endpoint for live AIS vessels."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from app.ais.broadcast import select_due, vessel_payload
from app.ais.registry import VesselRegistry
from app.config import settings

router = APIRouter(tags=["ais"])


class AisHub:
    def __init__(self) -> None:
        self.registry = VesselRegistry()
        self.enabled = bool(settings.aisstream_api_key)
        self.connected = False
        self._clients: set[WebSocket] = set()
        self._last_emit: dict[int, float] = {}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)
        for s in self.registry.tanker_states():  # snapshot on connect
            await ws.send_json(vessel_payload(s))

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def run_emitter(self, stop: asyncio.Event) -> None:
        interval_ms = settings.ais_throttle_seconds * 1000
        while not stop.is_set():
            now_ms = asyncio.get_event_loop().time() * 1000
            self.registry.prune(now_ms, ttl_ms=1_800_000)
            due = select_due(self.registry.tanker_states(), self._last_emit, now_ms, interval_ms)
            payloads = [vessel_payload(s) for s in due]
            dead: list[WebSocket] = []
            for ws in self._clients:
                try:
                    for p in payloads:
                        await ws.send_json(p)
                except Exception:  # noqa: BLE001
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws)
            await asyncio.sleep(settings.ais_throttle_seconds)


@router.get("/ais/status")
async def ais_status(request: Request):
    hub: AisHub = request.app.state.ais_hub
    return {
        "enabled": hub.enabled,
        "connected": hub.connected,
        "vessel_count": len(hub.registry.tanker_states()),
    }


@router.websocket("/ais/stream")
async def ais_stream(ws: WebSocket):
    hub: AisHub = ws.app.state.ais_hub
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keepalive; client sends nothing meaningful
    except WebSocketDisconnect:
        hub.disconnect(ws)
```

- [ ] **Step 4: Wire `backend/app/main.py`**

Add imports and a lifespan. Replace the top of `main.py` through the `app = FastAPI(...)` block with:

```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.countries import router as countries_router
from app.api.v1.flows import router as flows_router
from app.api.v1.chokepoints import router as chokepoints_router
from app.api.v1.infrastructures import router as infrastructures_router
from app.api.v1.scenarios import router as scenarios_router
from app.api.v1.fields import router as fields_router
from app.ais.router import AisHub, router as ais_router
from app.ais.client import run_ais_client
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    hub = AisHub()
    app.state.ais_hub = hub
    stop = asyncio.Event()
    tasks: list[asyncio.Task] = []
    if hub.enabled:
        hub.connected = True
        tasks.append(asyncio.create_task(run_ais_client(hub.registry, settings.aisstream_api_key, stop)))
        tasks.append(asyncio.create_task(hub.run_emitter(stop)))
    try:
        yield
    finally:
        stop.set()
        for t in tasks:
            t.cancel()


app = FastAPI(
    title="CrudeMap API",
    description="Petroleum dependency mapping and disruption simulation",
    version="0.1.0",
    lifespan=lifespan,
)
```

Then add the router registration alongside the others:

```python
app.include_router(ais_router, prefix=API_PREFIX)
```

- [ ] **Step 5: Run tests + full backend suite + commit**

Run: `docker compose build backend && docker compose run --rm backend python -m pytest tests/ -v` → all PASS.

```bash
git add backend/app/ais/router.py backend/app/main.py backend/tests/test_status_endpoint.py
git commit -m "feat(ais): WS hub, stream + status routes, lifespan wiring"
```

---

### Task 6: Frontend shared geo helpers

**Files:**
- Create: `frontend/src/components/Map/geo.ts`
- Test: `frontend/src/components/Map/geo.test.ts`

**Interfaces:**
- Produces:
  - `distKm(a: LonLat, b: LonLat): number`
  - `buildGreatCircleRoute(anchors: LonLat[], stepKm?: number): LonLat[]` (interpolated + longitude-unwrapped)
  - `advanceAlongRoute(route: LonLat[], distanceKm: number): { position: LonLat; bearing: number }`
  - type `LonLat = [number, number]`

- [ ] **Step 1: Write the failing test** — `frontend/src/components/Map/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { advanceAlongRoute, buildGreatCircleRoute, distKm } from './geo'

describe('geo', () => {
  it('distKm is ~111km per degree of latitude', () => {
    expect(distKm([0, 0], [0, 1])).toBeCloseTo(111.19, 0)
  })

  it('buildGreatCircleRoute densifies and keeps endpoints', () => {
    const route = buildGreatCircleRoute([[0, 0], [0, 10]], 200)
    expect(route[0]).toEqual([0, 0])
    expect(route[route.length - 1][1]).toBeCloseTo(10, 3)
    expect(route.length).toBeGreaterThan(3)
  })

  it('advanceAlongRoute walks the given distance', () => {
    const route: [number, number][] = [[0, 0], [0, 1], [0, 2]] // ~222 km total
    const { position } = advanceAlongRoute(route, 111.19)
    expect(position[1]).toBeCloseTo(1, 1)
    expect(position[0]).toBeCloseTo(0, 3)
  })

  it('advanceAlongRoute clamps to the last point when overshooting', () => {
    const route: [number, number][] = [[0, 0], [0, 1]]
    const { position } = advanceAlongRoute(route, 10_000)
    expect(position[1]).toBeCloseTo(1, 3)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/Map/geo.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `frontend/src/components/Map/geo.ts`**

```ts
/**
 * Shared great-circle geometry for route projection (AIS handoff) and any
 * other consumer. Mirrors the private helpers in flowGeometry.ts; kept
 * separate and unit-tested so the AIS engine can reuse it without touching
 * the (untested) flow renderer.
 */

export type LonLat = [number, number]

const RAD = Math.PI / 180

export function distKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function greatCircleLeg(a: LonLat, b: LonLat, stepKm: number): LonLat[] {
  const dist = distKm(a, b)
  const segments = Math.max(1, Math.ceil(dist / stepKm))
  if (segments === 1) return [a]
  const lat1 = a[1] * RAD, lon1 = a[0] * RAD, lat2 = b[1] * RAD, lon2 = b[0] * RAD
  const d = dist / 6371
  const sinD = Math.sin(d)
  if (sinD === 0) return [a]
  const points: LonLat[] = []
  for (let i = 0; i < segments; i += 1) {
    const f = i / segments
    const A = Math.sin((1 - f) * d) / sinD
    const B = Math.sin(f * d) / sinD
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    points.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD])
  }
  return points
}

function unwrapLongitudes(path: LonLat[]): LonLat[] {
  if (path.length === 0) return path
  const out: LonLat[] = [[...path[0]] as LonLat]
  for (let i = 1; i < path.length; i += 1) {
    let lon = path[i][0]
    const prev = out[i - 1][0]
    while (lon - prev > 180) lon -= 360
    while (lon - prev < -180) lon += 360
    out.push([lon, path[i][1]])
  }
  return out
}

export function buildGreatCircleRoute(anchors: LonLat[], stepKm = 200): LonLat[] {
  if (anchors.length < 2) return anchors
  const raw: LonLat[] = []
  for (let i = 0; i < anchors.length - 1; i += 1) {
    raw.push(...greatCircleLeg(anchors[i], anchors[i + 1], stepKm))
  }
  raw.push(anchors[anchors.length - 1])
  return unwrapLongitudes(raw)
}

function bearingDeg(a: LonLat, b: LonLat): number {
  return (Math.atan2((b[0] - a[0]) * Math.cos(a[1] * RAD), b[1] - a[1]) * 180) / Math.PI
}

/** Walk `distanceKm` from the start of `route`; clamp to the last vertex. */
export function advanceAlongRoute(route: LonLat[], distanceKm: number): { position: LonLat; bearing: number } {
  if (route.length === 1) return { position: route[0], bearing: 0 }
  let remaining = Math.max(0, distanceKm)
  for (let i = 0; i < route.length - 1; i += 1) {
    const segKm = distKm(route[i], route[i + 1])
    if (remaining <= segKm || i === route.length - 2) {
      const f = segKm > 0 ? Math.min(1, remaining / segKm) : 0
      const position: LonLat = [
        route[i][0] + (route[i + 1][0] - route[i][0]) * f,
        route[i][1] + (route[i + 1][1] - route[i][1]) * f,
      ]
      return { position, bearing: bearingDeg(route[i], route[i + 1]) }
    }
    remaining -= segKm
  }
  const last = route.length - 1
  return { position: route[last], bearing: bearingDeg(route[last - 1], route[last]) }
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/components/Map/geo.test.ts` → PASS.

```bash
git add frontend/src/components/Map/geo.ts frontend/src/components/Map/geo.test.ts
git commit -m "feat(ais): shared great-circle geo helpers (distance, route, advance)"
```

---

### Task 7: AIS handoff engine (`aisVessel.ts`)

**Files:**
- Create: `frontend/src/components/Map/aisVessel.ts`
- Test: `frontend/src/components/Map/aisVessel.test.ts`

**Interfaces:**
- Consumes: `LonLat`, `buildGreatCircleRoute`, `advanceAlongRoute`, `distKm` (Task 6); `nearestSeaNode`, `seaRouteVia`, `SEA_NODES` (searoutes.ts).
- Produces:
  - `interface LiveVessel { mmsi:number; name:string|null; type:number|null; lon:number; lat:number; sog:number; cog:number; heading:number|null; dest:LonLat|null; destName:string|null; lastSeenMs:number; firstSeenPos:LonLat }`
  - `type VesselMode = 'live' | 'projected' | 'faded'`
  - `interface VesselDisplay { mode:VesselMode; position:LonLat; bearing:number; opacity:number }`
  - `vesselDisplayState(v: LiveVessel, nowMs: number): VesselDisplay`
  - `LIVE_TTL_MS`, `FADE_DURATION_MS` constants
  - `clearRouteCache(): void` (test seam)

- [ ] **Step 1: Write the failing test** — `frontend/src/components/Map/aisVessel.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { FADE_DURATION_MS, LIVE_TTL_MS, clearRouteCache, vesselDisplayState, type LiveVessel } from './aisVessel'

function vessel(over: Partial<LiveVessel> = {}): LiveVessel {
  return {
    mmsi: 1, name: 'T', type: 80, lon: 55, lat: 25, sog: 12, cog: 90, heading: 90,
    dest: [4.1, 51.95], destName: 'Rotterdam', lastSeenMs: 0, firstSeenPos: [55, 25],
    ...over,
  }
}

describe('vesselDisplayState', () => {
  beforeEach(() => clearRouteCache())

  it('is live at the real position when fresh', () => {
    const d = vesselDisplayState(vessel(), LIVE_TTL_MS - 1000)
    expect(d.mode).toBe('live')
    expect(d.position).toEqual([55, 25])
    expect(d.opacity).toBe(1)
  })

  it('projects toward destination once stale', () => {
    const d = vesselDisplayState(vessel(), LIVE_TTL_MS + 60_000)
    expect(d.mode).toBe('projected')
    // moved off the last position toward Rotterdam (west) => longitude decreases
    expect(d.position[0]).toBeLessThan(55)
    expect(d.opacity).toBeLessThan(1)
  })

  it('fades when stale with no destination', () => {
    const d = vesselDisplayState(vessel({ dest: null }), LIVE_TTL_MS + FADE_DURATION_MS / 2)
    expect(d.mode).toBe('faded')
    expect(d.opacity).toBeGreaterThan(0)
    expect(d.opacity).toBeLessThan(1)
    const gone = vesselDisplayState(vessel({ dest: null }), LIVE_TTL_MS + FADE_DURATION_MS + 1000)
    expect(gone.opacity).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/Map/aisVessel.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `frontend/src/components/Map/aisVessel.ts`**

```ts
/**
 * AIS handoff engine: decides whether a vessel is shown at its real (live)
 * position, projected along a sea route toward its declared destination, or
 * fading out (destination unknown). Wall-clock driven.
 */
import { advanceAlongRoute, buildGreatCircleRoute, distKm, type LonLat } from './geo'
import { SEA_NODES, nearestSeaNode, seaRouteVia } from './searoutes'

export interface LiveVessel {
  mmsi: number
  name: string | null
  type: number | null
  lon: number
  lat: number
  sog: number
  cog: number
  heading: number | null
  dest: LonLat | null
  destName: string | null
  lastSeenMs: number
  firstSeenPos: LonLat
}

export type VesselMode = 'live' | 'projected' | 'faded'
export interface VesselDisplay {
  mode: VesselMode
  position: LonLat
  bearing: number
  opacity: number
}

export const LIVE_TTL_MS = 90_000 // fresh AIS window
export const FADE_DURATION_MS = 360_000 // 6 min ramp to invisible when dark w/o dest
const KN_TO_KMH = 1.852
const PROJECTED_OPACITY = 0.6

// Route cache keyed by mmsi|destLon|destLat|originLon|originLat.
const routeCache = new Map<string, LonLat[]>()
export function clearRouteCache(): void {
  routeCache.clear()
}

function projectionRoute(v: LiveVessel, dest: LonLat): LonLat[] {
  const key = `${v.mmsi}|${dest[0].toFixed(2)},${dest[1].toFixed(2)}|${v.lon.toFixed(1)},${v.lat.toFixed(1)}`
  const cached = routeCache.get(key)
  if (cached) return cached
  const from: LonLat = [v.lon, v.lat]
  const fromNode = nearestSeaNode(from)
  const toNode = nearestSeaNode(dest)
  const nodePath = seaRouteVia(fromNode, [], toNode) ?? [SEA_NODES[fromNode], SEA_NODES[toNode]]
  const route = buildGreatCircleRoute([from, ...nodePath, dest])
  routeCache.set(key, route)
  return route
}

export function vesselDisplayState(v: LiveVessel, nowMs: number): VesselDisplay {
  const age = nowMs - v.lastSeenMs

  if (age < LIVE_TTL_MS) {
    return { mode: 'live', position: [v.lon, v.lat], bearing: v.heading ?? v.cog, opacity: 1 }
  }

  const darkMs = age - LIVE_TTL_MS

  if (v.dest) {
    const route = projectionRoute(v, v.dest)
    const distanceKm = v.sog * KN_TO_KMH * (darkMs / 3_600_000)
    const { position, bearing } = advanceAlongRoute(route, distanceKm)
    return { mode: 'projected', position, bearing, opacity: PROJECTED_OPACITY }
  }

  const opacity = Math.max(0, 1 - darkMs / FADE_DURATION_MS)
  return { mode: 'faded', position: [v.lon, v.lat], bearing: v.heading ?? v.cog, opacity }
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/components/Map/aisVessel.test.ts` → PASS.

```bash
git add frontend/src/components/Map/aisVessel.ts frontend/src/components/Map/aisVessel.test.ts
git commit -m "feat(ais): vessel handoff engine (live/projected/faded)"
```

---

### Task 8: WS client hook, wsBase helper, store wiring

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/api/wsBase.test.ts`
- Create: `frontend/src/api/hooks/useAisVessels.ts`
- Modify: `frontend/src/store/mapStore.ts`

**Interfaces:**
- Consumes: `LiveVessel` (Task 7).
- Produces:
  - `wsBase(): string` in `client.ts` (e.g. `ws://localhost:8000`).
  - `useAisVessels(): { vessels: Map<number, LiveVessel>; status: AisStatus }` where `AisStatus = { enabled: boolean; connected: boolean; count: number }`.
  - store: `layers.aisLive: boolean` (default true); `aisStatus: AisStatus` + `setAisStatus`.

- [ ] **Step 1: Write the failing test** — `frontend/src/api/wsBase.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wsBase } from './client'

describe('wsBase', () => {
  it('maps http(s) base to ws(s)', () => {
    // default base is http://localhost:8000 in tests
    expect(wsBase()).toBe('ws://localhost:8000')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/api/wsBase.test.ts` → FAIL (`wsBase` not exported).

- [ ] **Step 3: Add `wsBase` to `frontend/src/api/client.ts`**

Replace the file with:

```ts
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

/** WebSocket origin derived from the REST base (http→ws, https→wss). */
export function wsBase(): string {
  return BASE_URL.replace(/^http/, 'ws')
}
```

- [ ] **Step 4: Run test → PASS**

Run: `npx vitest run src/api/wsBase.test.ts` → PASS.

- [ ] **Step 5: Store fields** — in `frontend/src/store/mapStore.ts`:

Add `'aisLive'` to the `LayerKey` union (after `'vessels'`):

```ts
  | 'vessels'
  | 'aisLive'
```

Add to `defaultLayers`:

```ts
  aisLive: true,
```

Add an `AisStatus` type and store slice. Add near the top:

```ts
export interface AisStatus {
  enabled: boolean
  connected: boolean
  count: number
}
```

Add to the `MapStore` interface:

```ts
  aisStatus: AisStatus
  setAisStatus: (status: AisStatus) => void
```

Add to the store initializer (in the `create<MapStore>` object):

```ts
  aisStatus: { enabled: false, connected: false, count: 0 },
  setAisStatus: status => set({ aisStatus: status }),
```

- [ ] **Step 6: Implement `frontend/src/api/hooks/useAisVessels.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { apiClient, wsBase } from '../client'
import type { LiveVessel } from '../../components/Map/aisVessel'
import { useMapStore } from '../../store/mapStore'

interface AisMessage {
  mmsi: number
  name: string | null
  type: number | null
  lon: number
  lat: number
  sog: number
  cog: number
  heading: number | null
  dest: [number, number] | null
  dest_name: string | null
  ts: number
}

/**
 * Subscribes to the backend AIS relay. Returns a live vessel map (keyed by
 * MMSI) updated in place, plus connection status. Falls back silently when
 * the backend has no key or is unreachable.
 */
export function useAisVessels(): { vessels: Map<number, LiveVessel> } {
  const vesselsRef = useRef<Map<number, LiveVessel>>(new Map())
  const [, forceTick] = useState(0)
  const setAisStatus = useMapStore(s => s.setAisStatus)

  useEffect(() => {
    let enabled = false
    apiClient
      .get('/ais/status')
      .then(res => {
        enabled = Boolean(res.data?.enabled)
        setAisStatus({ enabled, connected: false, count: res.data?.vessel_count ?? 0 })
      })
      .catch(() => setAisStatus({ enabled: false, connected: false, count: 0 }))

    let ws: WebSocket | null = null
    let closed = false
    let retry = 1000

    const connect = () => {
      if (closed) return
      ws = new WebSocket(`${wsBase()}/api/v1/ais/stream`)
      ws.onopen = () => {
        retry = 1000
        setAisStatus({ enabled: true, connected: true, count: vesselsRef.current.size })
      }
      ws.onmessage = event => {
        const m: AisMessage = JSON.parse(event.data)
        const prev = vesselsRef.current.get(m.mmsi)
        vesselsRef.current.set(m.mmsi, {
          mmsi: m.mmsi,
          name: m.name,
          type: m.type,
          lon: m.lon,
          lat: m.lat,
          sog: m.sog,
          cog: m.cog,
          heading: m.heading,
          dest: m.dest,
          destName: m.dest_name,
          lastSeenMs: Date.now(),
          firstSeenPos: prev?.firstSeenPos ?? [m.lon, m.lat],
        })
      }
      ws.onclose = () => {
        setAisStatus({ enabled, connected: false, count: vesselsRef.current.size })
        if (!closed) {
          setTimeout(connect, retry)
          retry = Math.min(retry * 2, 30000)
        }
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    // Re-render consumers ~4x/sec so the layer re-reads positions
    const tick = setInterval(() => forceTick(t => t + 1), 250)

    return () => {
      closed = true
      clearInterval(tick)
      ws?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { vessels: vesselsRef.current }
}
```

- [ ] **Step 7: Build + tests + commit**

Run: `npx vitest run` → PASS. Run: `npm run build` → success.

```bash
git add frontend/src/api/client.ts frontend/src/api/wsBase.test.ts frontend/src/api/hooks/useAisVessels.ts frontend/src/store/mapStore.ts
git commit -m "feat(ais): ws client hook, wsBase helper, store status slice"
```

---

### Task 9: `AisVesselLayer` + WorldMap wiring

**Files:**
- Create: `frontend/src/components/Map/AisVesselLayer.tsx`
- Modify: `frontend/src/components/Map/WorldMap.tsx`

**Interfaces:**
- Consumes: `LiveVessel`, `vesselDisplayState` (Task 7); `useAisVessels` (Task 8); `getIcon` (iconAtlas); `globeParams`, `pointVisibleOnGlobe` (globeCulling); `ALERT`, `HIGHLIGHT`, `accentFor`, `withAlpha` (mapTheme).
- Produces: `AisVesselLayer(props): any[]` returning deck.gl layers.

- [ ] **Step 1: Implement `frontend/src/components/Map/AisVesselLayer.tsx`**

```tsx
import { IconLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Commodity } from '../../api/types'
import { getIcon } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'
import { accentFor, withAlpha } from './mapTheme'
import { vesselDisplayState, type LiveVessel } from './aisVessel'

interface Props {
  vessels: Map<number, LiveVessel>
  commodity: Commodity
  nowMs: number
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
}

const TYPE_LABEL = 'Tanker (AIS)'

/** Real AIS tankers: live where visible, projected along their route when dark. */
export function AisVesselLayer({ vessels, commodity, nowMs, globe, cameraCenter, onHover }: Props) {
  const accent = accentFor(commodity)

  const data = [...vessels.values()]
    .map(v => {
      const d = vesselDisplayState(v, nowMs)
      const speed = `${v.sog.toFixed(1)} kn`
      const modeLabel = d.mode === 'live' ? 'live AIS' : d.mode === 'projected' ? 'projected · sim' : 'signal lost'
      const destLine = v.destName ? `→ ${v.destName}` : '→ destination unknown'
      return {
        ...v,
        ...d,
        __tooltip: `M/T ${v.name ?? v.mmsi} — ${TYPE_LABEL}\n${speed} · ${destLine}\n${modeLabel}`,
      }
    })
    .filter(d => d.opacity > 0.02)
    .filter(d => !globe || pointVisibleOnGlobe(d.position, cameraCenter))

  const hitLayer = new ScatterplotLayer({
    id: 'ais-hit',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 9,
    radiusUnits: 'pixels',
    getFillColor: [0, 0, 0, 1],
    stroked: false,
    pickable: true,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPosition: [nowMs] },
  })

  // Faint wake for projected vessels (last known → current projected point)
  const wakeData = data.filter((d: any) => d.mode === 'projected')
  const wakeLayer = new PathLayer({
    id: 'ais-wake',
    data: wakeData,
    getPath: (d: any) => [[d.lon, d.lat], d.position],
    getColor: withAlpha(accent, 70),
    getWidth: 1,
    widthUnits: 'pixels',
    getDashArray: [4, 4] as any,
    dashJustified: true,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPath: [nowMs] },
  } as any)

  const iconLayer = new IconLayer({
    id: 'ais-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: () => getIcon('vessel'),
    getSize: (d: any) => (d.type ? 12 : 11),
    getColor: (d: any) => withAlpha(accent, Math.round(d.opacity * 240)),
    getAngle: (d: any) => -d.bearing,
    sizeUnits: 'pixels',
    billboard: false,
    pickable: true,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getPosition: [nowMs],
      getAngle: [nowMs],
      getColor: [nowMs, commodity],
    },
  })

  // Small "live" ring on genuinely-live vessels
  const liveRing = new ScatterplotLayer({
    id: 'ais-live-ring',
    data: data.filter((d: any) => d.mode === 'live'),
    getPosition: (d: any) => d.position,
    getRadius: 7,
    radiusUnits: 'pixels',
    stroked: true,
    filled: false,
    getLineColor: withAlpha(accent, 150),
    getLineWidth: 1.2,
    lineWidthUnits: 'pixels',
    pickable: false,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPosition: [nowMs] },
  })

  return [wakeLayer, hitLayer, liveRing, iconLayer]
}
```

- [ ] **Step 2: Wire into `frontend/src/components/Map/WorldMap.tsx`**

Add imports near the other Map imports:

```tsx
import { AisVesselLayer } from './AisVesselLayer'
import { useAisVessels } from '../../api/hooks/useAisVessels'
```

Inside the component, after the existing `useFlows`/hooks block, add:

```tsx
  const { vessels: aisVessels } = useAisVessels()
```

`animTime` already re-renders each frame; derive a wall-clock value for AIS. Add near where `animTime` is used:

```tsx
  const nowMs = Date.now()
```

In the `layers` array, add the AIS layer after the simulated `VesselLayer` block (so real tankers paint above ambient sim). Insert:

```tsx
    layerVisibility.aisLive &&
      aisVessels.size > 0 &&
      AisVesselLayer({
        vessels: aisVessels,
        commodity,
        nowMs,
        globe: isGlobe,
        cameraCenter,
        onHover: handleHover,
      }),
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` → success. Run: `npx vitest run` → PASS.

```bash
git add frontend/src/components/Map/AisVesselLayer.tsx frontend/src/components/Map/WorldMap.tsx
git commit -m "feat(ais): live AIS vessel layer wired into the map"
```

---

### Task 10: Simulated-traffic restyle + layer controls

**Files:**
- Modify: `frontend/src/components/Map/VesselLayer.tsx`
- Modify: `frontend/src/components/Controls/LayersPanel.tsx`
- Modify: `frontend/src/components/Map/MapLegend.tsx`

**Interfaces:**
- Consumes: `useMapStore().aisStatus` (Task 8); `ui` (uiTheme).

- [ ] **Step 1: Ghost the simulated fleet** — in `VesselLayer.tsx`, lower its presence so real AIS reads as primary.

Change the base color alpha in the icon layer: replace `const baseColor = withAlpha(accentFor(commodity), 225)` with:

```ts
  const baseColor = withAlpha(accentFor(commodity), 150) // simulated = ghosted vs live AIS
```

And reduce sizes: in `CLASS_SIZE`, this stays, but change the default in `getSize` fallback from `?? 9` to `?? 8`. (Cosmetic separation from live tankers.)

- [ ] **Step 2: LayersPanel — AIS row + connection dot + relabel** — in `LayersPanel.tsx`:

Import the store status (the component already calls `useMapStore`): change the destructure to include `aisStatus`:

```ts
  const { layers, toggleLayer, commodity, aisStatus } = useMapStore()
```

In the `Flows` group `rows`, prepend a live-AIS row and relabel the simulated one:

```ts
    {
      title: 'Flows',
      rows: [
        { key: 'aisLive', label: 'Live tankers (AIS)', color: isGas ? ui.gas : ui.oil, count: aisStatus.count || undefined },
        { key: 'flows', label: isGas ? 'Gas trade flows' : 'Oil trade flows', color: accent, count: counts.flows },
        { key: 'vessels', label: 'Simulated traffic', color: ui.neutral, count: counts.vessels },
        { key: 'pipelines', label: isGas ? 'Gas pipelines' : 'Oil pipelines', color: ui.neutral, count: counts.pipelines },
      ],
    },
```

(Add `aisLive` handling: `LayerRow.key` is typed `LayerKey`, which now includes `aisLive` from Task 8 — no type change needed.)

Add a connection indicator next to the "Layers" header count. Replace the header count span:

```tsx
        <span className="flex items-center gap-2">
          {aisStatus.enabled && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              title={aisStatus.connected ? 'AIS live' : 'AIS reconnecting'}
              style={{ background: aisStatus.connected ? ui.safe : ui.orange }}
            />
          )}
          <span className="font-mono text-[9px] text-text-muted">{activeCount} on</span>
          <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.95rem' }}>
            {open ? 'remove' : 'add'}
          </span>
        </span>
```

Add `import { ui } from '../../uiTheme'` if not already present (it is, from the light redesign).

- [ ] **Step 3: MapLegend — mention live tankers** — in `MapLegend.tsx`, in the `keyRows` build, add near the vessels entry:

```ts
  if (layers.aisLive) {
    keyRows.push({ label: 'Live tankers · real AIS', color: accent, shape: 'dot' })
  }
```

(The existing `layers.vessels` row stays; relabel its text to `'Simulated traffic'` where it reads `'Tankers · simulated live'` / `'LNG carriers · simulated live'` — set both to `commodity === 'gas' ? 'Simulated LNG traffic' : 'Simulated tanker traffic'`.)

- [ ] **Step 4: Build + commit**

Run: `npm run build` → success. Run: `npx vitest run` → PASS.

```bash
git add frontend/src/components/Map/VesselLayer.tsx frontend/src/components/Controls/LayersPanel.tsx frontend/src/components/Map/MapLegend.tsx
git commit -m "feat(ais): simulated traffic restyle, live-AIS layer row and status dot"
```

---

### Task 11: Ops — compose env, .env.example, README

**Files:**
- Modify: `docker-compose.yml`
- Create/Modify: `backend/.env.example`
- Modify: `README.md`

**Interfaces:** none (config/docs).

- [ ] **Step 1: Pass the key through compose** — in `docker-compose.yml`, under the `backend` service `environment:` map, add:

```yaml
      AISSTREAM_API_KEY: ${AISSTREAM_API_KEY:-}
```

- [ ] **Step 2: Document the key** — create/append `backend/.env.example`:

```
# Optional: free key from https://aisstream.io/apikeys — enables live AIS tankers.
# Without it, the app runs with simulated traffic only.
AISSTREAM_API_KEY=
```

- [ ] **Step 3: README note** — in `README.md`, under the live tanker fleet highlight, add a sentence and a setup line.

In the "Live tanker fleet (simulated)" highlight, append:

```
Add a free [AISStream.io](https://aisstream.io) API key (`AISSTREAM_API_KEY` in
the environment) to overlay **real tankers moving in real time**; when a vessel
sails out of AIS range its marker continues in simulation toward its declared
destination, then snaps back to live when it reappears. No key ⇒ simulated
traffic only.
```

In "Quick start", after `docker compose up -d`, add:

```bash
# Optional — live AIS tankers:
export AISSTREAM_API_KEY=your_free_key   # then: docker compose up -d
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/.env.example README.md
git commit -m "docs(ais): document AISSTREAM_API_KEY and compose passthrough"
```

---

### Task 12: Integration + visual QA

**Files:** none planned — fix regressions in the owning file.

- [ ] **Step 1: Backend suite green**

Run: `docker compose build backend && docker compose run --rm backend python -m pytest tests/ -v`
Expected: all tests pass (ports, registry, broadcast, client decode, status endpoint).

- [ ] **Step 2: No-key path (default)**

Start stack without a key: `docker compose up -d`. Start the frontend preview. Confirm:
1. App loads light UI, simulated traffic visible.
2. `curl http://localhost:8000/api/v1/ais/status` → `{"enabled":false,...}`.
3. LayersPanel shows "Live tankers (AIS)" row (count 0), no green AIS dot; "Simulated traffic" row present.
4. No console errors from the WS hook (it should retry quietly).

- [ ] **Step 3: Live path (with key)**

Set `AISSTREAM_API_KEY` and restart backend: `docker compose up -d`. Confirm:
1. `/api/v1/ais/status` → `{"enabled":true,"connected":true,...}` and `vessel_count` climbs.
2. Real tanker icons appear (near coasts/chokepoints first); AIS status dot green.
3. Hover a vessel → tooltip shows real name, speed, destination, "live AIS".
4. Leave it running; a vessel that stops updating switches to a projected wake toward its destination ("projected · sim" in tooltip), or fades if destination unknown.
5. Toggle "Live tankers (AIS)" and "Simulated traffic" independently — both work.
6. Switch to globe: AIS vessels cull to the front hemisphere, no z-fighting.

- [ ] **Step 4: Fix + final commit (skip if nothing to fix)**

```bash
git add -A
git commit -m "fix(ais): integration QA adjustments"
```

---

## Self-Review Notes

- **Spec coverage:** backend `ais/` module → Tasks 1–5 (ports 1, registry 2, broadcast 3, client 4, router+lifespan+status 5); frontend engine → Tasks 6–7 (geo 6, aisVessel 7); WS hook + store → Task 8; layer + wiring → Task 9; simulated-traffic restyle + controls → Task 10; graceful-degradation → Tasks 5 (status), 8 (hook fallback), 12 (no-key QA); ops/docs → Task 11.
- **Type consistency:** `LiveVessel` fields (Task 7) match the WS message mapping (Task 8) and layer reads (Task 9). `VesselState`/`vessel_payload` keys (Tasks 2–3) match the frontend `AisMessage` shape (Task 8). `aisLive` layer key added in Task 8, used in Tasks 9–10. `AisStatus` shape consistent across store (8) and LayersPanel (10).
- **Reliability:** no-key ⇒ task not started (Task 5 lifespan), status `enabled:false` (Task 5), hook falls back silently (Task 8), QA verifies (Task 12).
- **Known external dependency:** exact AISStream field names/bounding-box order are pinned to the shapes documented at the top of this plan; if AISStream's live payload differs, Task 4's `dispatch_message` is the single place to adjust (its unit test encodes the assumed shape).
