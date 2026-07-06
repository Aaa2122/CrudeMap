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
