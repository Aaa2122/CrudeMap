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
