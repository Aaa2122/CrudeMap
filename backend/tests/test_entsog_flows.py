from etl.entsog_flows import aggregate_physical_flows, build_direction_routes


def test_entsog_routes_and_flows_prefer_importer_entry_side() -> None:
    interconnections = [
        {
            "fromInfrastructureTypeLabel": "Transmission",
            "toInfrastructureTypeLabel": "Transmission",
            "fromCountryKey": "AA",
            "toCountryKey": "BB",
            "fromOperatorKey": "AA-TSO",
            "fromPointKey": "P1",
            "fromDirectionKey": "exit",
            "toOperatorKey": "BB-TSO",
            "toPointKey": "P1",
            "toDirectionKey": "entry",
        }
    ]
    routes = build_direction_routes(interconnections, {"AA": "AAA", "BB": "BBB"})
    observations = [
        {
            "indicator": "Physical Flow",
            "unit": "kWh/d",
            "periodFrom": "2026-01-01T06:00:00+01:00",
            "operatorKey": "AA-TSO",
            "pointKey": "P1",
            "directionKey": "exit",
            "value": 110_000_000,
        },
        {
            "indicator": "Physical Flow",
            "unit": "kWh/d",
            "periodFrom": "2026-01-01T06:00:00+01:00",
            "operatorKey": "BB-TSO",
            "pointKey": "P1",
            "directionKey": "entry",
            "value": 100_000_000,
        },
        {
            "indicator": "Physical Flow",
            "unit": "kWh/d",
            "periodFrom": "2026-01-02T06:00:00+01:00",
            "operatorKey": "AA-TSO",
            "pointKey": "P1",
            "directionKey": "exit",
            "value": 110_000_000,
        },
    ]

    flows, report = aggregate_physical_flows(observations, routes, year=2026)

    assert len(flows) == 1
    flow = flows[0]
    assert (flow["source_iso"], flow["target_iso"]) == ("AAA", "BBB")
    assert flow["transport_mode"] == "pipeline"
    assert flow["period"] == "2026-01-01/2026-01-02"
    assert flow["coverage_days"] == 2
    assert flow["points_count"] == 1
    assert flow["reporting_basis"] == "mixed_operator_sides"
    assert flow["volume_bcm"] == 3.632701422
    assert report["cross_border_share_of_all_positive_pct"] == 100.0
    assert report["topology_direction_keys_observed"] == 2
    assert report["topology_direction_key_use_pct"] == 100.0
