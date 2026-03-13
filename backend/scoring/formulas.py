"""Pure scoring functions.

All functions take plain dicts/floats and return floats.
No database dependency — easy to unit-test and replace.
"""


def supplier_hhi(flows: list[dict], target_iso: str) -> float:
    """Herfindahl–Hirschman Index of supplier concentration.
    Result is 0–10000. Higher = more concentrated (risky).
    """
    inflows = [f for f in flows if f["target_iso"] == target_iso]
    total = sum(f["volume_mt"] for f in inflows)
    if total == 0:
        return 0.0
    return sum((f["volume_mt"] / total * 100) ** 2 for f in inflows)


def route_concentration(flows: list[dict], target_iso: str, chokepoint_slug: str) -> float:
    """Share of imports for target_iso that pass through a given chokepoint (0–1)."""
    inflows = [f for f in flows if f["target_iso"] == target_iso]
    total = sum(f["volume_mt"] for f in inflows)
    if total == 0:
        return 0.0
    via = sum(
        f["volume_mt"]
        for f in inflows
        if chokepoint_slug in (f.get("via_chokepoints") or [])
    )
    return via / total


def dependency_score(import_mt: float, consumption_mt: float) -> float:
    """Fraction of consumption that is imported (0–1)."""
    if consumption_mt <= 0:
        return 0.0
    return min(import_mt / consumption_mt, 1.0)


def resilience_score(dep: float, hhi: float, max_route_conc: float) -> float:
    """Overall resilience: 100 = fully resilient, 0 = critically exposed.

    Weights:
      40% dependency (import reliance)
      40% supplier concentration (HHI normalised 0-1)
      20% max single chokepoint exposure
    """
    hhi_norm = min(hhi / 10000.0, 1.0)
    score = 100.0 - (0.40 * dep * 100 + 0.40 * hhi_norm * 100 + 0.20 * max_route_conc * 100)
    return max(0.0, min(100.0, score))


def importance_score(
    production_mt: float,
    export_mt: float,
    import_mt: float,
    is_hub: bool = False,
) -> float:
    """Strategic importance of a country in the global oil system (0–100)."""
    prod_score = min(production_mt / 1000.0, 1.0) * 35
    export_score = min(export_mt / 400.0, 1.0) * 35
    import_score = min(import_mt / 560.0, 1.0) * 20
    hub_bonus = 10.0 if is_hub else 0.0
    return min(prod_score + export_score + import_score + hub_bonus, 100.0)


def stress_score(
    volume_lost_pct: float,
    cost_increase_pct: float,
    hhi_before: float,
    hhi_after: float,
) -> float:
    """Stress a country experiences under a disruption scenario (0–100).

    volume_lost_pct: fraction of imports lost (0–1)
    cost_increase_pct: cost multiplier increase expressed as 0-1 fraction
    hhi_before/after: supplier concentration before and after
    """
    concentration_delta = min((hhi_after - hhi_before) / 10000.0, 1.0)
    raw = (
        volume_lost_pct * 60
        + min(cost_increase_pct, 1.0) * 20
        + max(concentration_delta, 0.0) * 20
    )
    return min(raw, 100.0)
