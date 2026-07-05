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
