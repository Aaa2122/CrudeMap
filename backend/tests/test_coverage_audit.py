from etl.audit_coverage import build_report


def test_coverage_audit_has_measurable_reference_target() -> None:
    report = build_report()

    assert report["target"] == "2026 YTD"
    assert report["country_universe"] > 170
    assert report["records"]["countries"] > 0
    assert report["records"]["oil_flows"] > 0
    assert report["records"]["gas_flows"] > 0
    assert report["freshness"]["stale_country_rows"] > 0
    assert report["freshness"]["current_oil_profiles"] > 0
    assert report["freshness"]["current_gas_profiles"] > 0
    assert report["freshness"]["fully_current_profiles"] <= report["freshness"]["current_country_rows"]
    assert report["gaps"]["missing_gas_flow_endpoints"]
    assert report["gaps"]["stale_oil_profiles"]
    assert report["gaps"]["stale_gas_profiles"]
    assert report["gaps"]["missing_current_oil_flow_endpoints"]
    assert report["gaps"]["missing_current_gas_flow_endpoints"]
    assert report["source_quality"]["eurostat_partner_allocation"]["allocation_pct"] > 99
    assert report["source_quality"]["entsog_pipeline_flows"]["directed_country_flows"] > 50
    assert report["source_quality"]["entsog_pipeline_flows"]["period"] == "2026-01-01/2026-06-30"
    comtrade = report["source_quality"]["comtrade_public_preview"]
    assert comtrade["reporters_with_energy_rows"] > 50
    assert comtrade["periods"][-1] == "202606"
    assert comtrade["truncated_responses_accepted"] == 0
