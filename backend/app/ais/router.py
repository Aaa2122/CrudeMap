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
