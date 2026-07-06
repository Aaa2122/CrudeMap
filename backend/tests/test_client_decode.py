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
