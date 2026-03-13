"""Simulation engine: NetworkX-based flow disruption calculator.

Pure Python — no DB queries. Receives data as plain dicts, returns results.

Flow of a simulation run:
1. Build directed graph: nodes = countries, edges = flows with attrs
2. Apply scenario disruptions (reduce capacity / raise cost on affected edges)
3. For each importer, compute:
   - volume_lost_mt (imports that can no longer arrive)
   - cost_increase_pct (weighted average cost increase)
   - can_reroute (are there alternative paths?)
   - stress_score (0-100)
"""
import networkx as nx
from scoring.formulas import stress_score, supplier_hhi


def build_graph(flows: list[dict]) -> nx.DiGraph:
    G = nx.DiGraph()
    for f in flows:
        G.add_edge(
            f["source_iso"],
            f["target_iso"],
            volume_mt=f["volume_mt"],
            capacity_factor=1.0,   # 1.0 = fully available
            cost_multiplier=1.0,
            via_chokepoints=f.get("via_chokepoints") or [],
            flow_id=f.get("id"),
        )
    return G


def apply_scenario(G: nx.DiGraph, disruptions: list[dict]) -> nx.DiGraph:
    """Return a modified copy of the graph with disruptions applied.

    disruption format:
      {"target_type": "chokepoint"|"country", "target_id": str,
       "param": "capacity_factor"|"cost_multiplier", "delta": float}
    """
    H = G.copy()

    for d in disruptions:
        t_type = d["target_type"]
        t_id = d["target_id"]
        param = d["param"]
        delta = d["delta"]

        for u, v, attrs in list(H.edges(data=True)):
            affected = False
            if t_type == "chokepoint" and t_id in attrs.get("via_chokepoints", []):
                affected = True
            elif t_type == "country" and u == t_id:
                affected = True

            if affected:
                if param == "capacity_factor":
                    # Take the most restrictive capacity factor
                    current = H[u][v].get("capacity_factor", 1.0)
                    H[u][v]["capacity_factor"] = min(current, delta)
                elif param == "cost_multiplier":
                    current = H[u][v].get("cost_multiplier", 1.0)
                    H[u][v]["cost_multiplier"] = max(current, delta)

    return H


def compute_country_impact(
    G_baseline: nx.DiGraph,
    G_scenario: nx.DiGraph,
    target_iso: str,
    all_flows: list[dict],
) -> dict:
    """Compute disruption impact for a single importing country."""
    # Baseline imports
    baseline_flows = [
        (u, G_baseline[u][target_iso])
        for u in G_baseline.predecessors(target_iso)
        if G_baseline.has_edge(u, target_iso)
    ]
    baseline_total = sum(attrs["volume_mt"] for _, attrs in baseline_flows)
    if baseline_total == 0:
        return {
            "country_iso": target_iso,
            "stress_score": 0.0,
            "volume_lost_mt": 0.0,
            "cost_increase_pct": 0.0,
            "can_reroute": False,
            "baseline_import_mt": 0.0,
        }

    # Scenario imports
    scenario_flows = [
        (u, G_scenario[u][target_iso])
        for u in G_scenario.predecessors(target_iso)
        if G_scenario.has_edge(u, target_iso)
    ]

    available_mt = sum(
        attrs["volume_mt"] * attrs.get("capacity_factor", 1.0)
        for _, attrs in scenario_flows
    )
    volume_lost = max(0.0, baseline_total - available_mt)
    volume_lost_pct = volume_lost / baseline_total if baseline_total > 0 else 0.0

    # Weighted average cost increase
    weighted_cost = sum(
        attrs["volume_mt"] * attrs.get("cost_multiplier", 1.0)
        for _, attrs in scenario_flows
    )
    avg_cost_mult = weighted_cost / baseline_total if baseline_total > 0 else 1.0
    cost_increase_pct = max(0.0, avg_cost_mult - 1.0)

    # Can reroute? Check if any flow has capacity_factor > 0 from non-disrupted source
    can_reroute = any(
        attrs.get("capacity_factor", 1.0) > 0
        for _, attrs in scenario_flows
        if attrs.get("capacity_factor", 1.0) < 1.0   # disrupted but not zero
    )

    # HHI before/after
    hhi_before = supplier_hhi(all_flows, target_iso)
    scenario_flow_dicts = [
        {"source_iso": u, "target_iso": target_iso,
         "volume_mt": attrs["volume_mt"] * attrs.get("capacity_factor", 1.0)}
        for u, attrs in scenario_flows
    ]
    hhi_after = supplier_hhi(scenario_flow_dicts, target_iso)

    score = stress_score(volume_lost_pct, cost_increase_pct, hhi_before, hhi_after)

    return {
        "country_iso": target_iso,
        "stress_score": round(score, 1),
        "volume_lost_mt": round(volume_lost, 1),
        "cost_increase_pct": round(cost_increase_pct * 100, 1),
        "can_reroute": can_reroute,
        "baseline_import_mt": round(baseline_total, 1),
    }


def run_scenario(
    flows: list[dict],
    countries: list[dict],
    disruptions: list[dict],
) -> list[dict]:
    """Run a full scenario and return impact per importer country."""
    G_baseline = build_graph(flows)
    G_scenario = apply_scenario(G_baseline, disruptions)

    importers = [c["iso"] for c in countries if (c.get("import_oil_mt") or 0) > 0]

    results = []
    for iso in importers:
        if G_baseline.has_node(iso) and any(G_baseline.predecessors(iso)):
            impact = compute_country_impact(G_baseline, G_scenario, iso, flows)
            results.append(impact)

    # Sort by stress score descending
    results.sort(key=lambda x: x["stress_score"], reverse=True)
    return results
