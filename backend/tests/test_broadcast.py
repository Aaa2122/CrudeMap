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
