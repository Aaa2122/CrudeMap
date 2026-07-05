"""Frontend-facing payloads + per-vessel throttling.

The WS hub (router.py) uses these helpers; keeping them pure makes throttling
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
