"""In-memory registry joining AIS static + position messages per MMSI.

Only tankers/LNG (ship type 80-89) are ever emitted. Positions arriving
before static data are retained (type unknown) and become visible once the
static message confirms a tanker.
"""
from __future__ import annotations

from dataclasses import dataclass


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
