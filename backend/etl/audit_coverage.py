"""Audit CrudeMap country, flow, provenance, and freshness coverage.

Run from the repository root:
    python backend/etl/audit_coverage.py
    python backend/etl/audit_coverage.py --json
    python backend/etl/audit_coverage.py --strict
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    from etl.eurostat_comext import partner_allocation_report
except ModuleNotFoundError:  # direct `python backend/etl/audit_coverage.py`
    from eurostat_comext import partner_allocation_report

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).parent / "data"
MAP_FILE = REPO_ROOT / "frontend" / "public" / "world-countries.geojson"

OIL_FIELDS = (
    "production_oil_mt",
    "import_oil_mt",
    "export_oil_mt",
    "consumption_oil_mt",
)
GAS_FIELDS = (
    "production_gas_bcm",
    "import_gas_bcm",
    "export_gas_bcm",
    "consumption_gas_bcm",
)


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _mapped_countries() -> dict[str, str]:
    features = _load(MAP_FILE)["features"]
    countries: dict[str, str] = {}
    for feature in features:
        props = feature["properties"]
        iso = props.get("ISO_A3")
        if not iso or iso == "-99":
            iso = props.get("ADM0_A3")
        if iso and iso != "-99":
            countries[iso] = props.get("NAME_EN") or props.get("NAME") or iso
    return countries


def _has_reported_profile(country: dict[str, Any], fields: tuple[str, ...], commodity: str) -> bool:
    # Until per-metric nullability is introduced, a profile counts as reported only
    # when the row has provenance and at least one non-zero observation.
    if country.get(f"{commodity}_source"):
        return True
    return bool(country.get("source")) and any((country.get(field) or 0) != 0 for field in fields)


def build_report() -> dict[str, Any]:
    mapped = _mapped_countries()
    countries = _load(DATA_DIR / "countries.json")
    oil_flows = _load(DATA_DIR / "flows.json")
    gas_flows = _load(DATA_DIR / "flows_gas.json")
    manifest = _load(DATA_DIR / "data_manifest.json")
    comext_source = Path(__file__).parent / "sources" / "eurostat_comext_2026_ytd.json"
    entsog_quality_source = Path(__file__).parent / "sources" / "entsog_quality_2026_ytd.json"
    comtrade_source = Path(__file__).parent / "sources" / "comtrade_2026_ytd.json"
    comtrade_quality_source = Path(__file__).parent / "sources" / "comtrade_2026_quality.json"

    by_iso = {row["iso"]: row for row in countries}
    mapped_isos = set(mapped)
    country_isos = set(by_iso)
    oil_endpoints = {row["source_iso"] for row in oil_flows} | {row["target_iso"] for row in oil_flows}
    gas_endpoints = {row["source_iso"] for row in gas_flows} | {row["target_iso"] for row in gas_flows}
    target_year = str(manifest["policy"]["current_year"])
    current_oil_flows = [
        row for row in oil_flows
        if str(row.get("period") or row.get("year") or "").startswith(target_year)
    ]
    current_gas_flows = [
        row for row in gas_flows
        if str(row.get("period") or row.get("year") or "").startswith(target_year)
    ]
    current_oil_endpoints = {
        iso for row in current_oil_flows for iso in (row["source_iso"], row["target_iso"])
    }
    current_gas_endpoints = {
        iso for row in current_gas_flows for iso in (row["source_iso"], row["target_iso"])
    }
    oil_profiles = {iso for iso, row in by_iso.items() if _has_reported_profile(row, OIL_FIELDS, "oil")}
    gas_profiles = {iso for iso, row in by_iso.items() if _has_reported_profile(row, GAS_FIELDS, "gas")}

    missing_rows = mapped_isos - country_isos
    stale_rows = {
        iso
        for iso in mapped_isos & country_isos
        if (by_iso[iso].get("source_year") or 0) < manifest["policy"]["current_year"]
    }
    oil_current = {
        iso
        for iso in mapped_isos & country_isos
        if str(by_iso[iso].get("oil_period") or "").startswith(str(manifest["policy"]["current_year"]))
    }
    gas_current = {
        iso
        for iso in mapped_isos & country_isos
        if str(by_iso[iso].get("gas_period") or "").startswith(str(manifest["policy"]["current_year"]))
    }
    oil_missing = mapped_isos - oil_profiles
    gas_missing = mapped_isos - gas_profiles

    def named(isos: set[str]) -> list[dict[str, str]]:
        return [{"iso": iso, "name": mapped.get(iso, by_iso.get(iso, {}).get("name", iso))} for iso in sorted(isos)]

    total = len(mapped_isos)
    source_quality: dict[str, Any] = {}
    if comext_source.exists():
        features = _load(MAP_FILE)["features"]
        valid_alpha2 = {
            str(feature["properties"].get("ISO_A2"))
            for feature in features
            if feature["properties"].get("ISO_A2") not in (None, "-99")
        }
        valid_alpha2.update({"FR", "NO", "XK"})
        source_quality["eurostat_partner_allocation"] = partner_allocation_report(
            _load(comext_source), valid_alpha2
        )
    if entsog_quality_source.exists():
        source_quality["entsog_pipeline_flows"] = _load(entsog_quality_source)
    if comtrade_source.exists():
        comtrade_rows = _load(comtrade_source)
        physical_rows = [
            row for row in comtrade_rows
            if row.get("reporterISO")
            and row.get("partnerISO") not in (None, "W00")
            and row.get("cmdCode") in ("2709", "271111")
            and float(row.get("netWgt") or 0) > 0
        ]
        collector_quality = _load(comtrade_quality_source) if comtrade_quality_source.exists() else {}
        source_quality["comtrade_public_preview"] = {
            "raw_rows": len(comtrade_rows),
            "usable_physical_rows": len(physical_rows),
            "periods": sorted({str(row.get("period")) for row in comtrade_rows if row.get("period")}),
            "reporters_with_energy_rows": len({row.get("reporterISO") for row in physical_rows}),
            "partners_with_energy_rows": len({row.get("partnerISO") for row in physical_rows}),
            "reporter_months": len({(row.get("period"), row.get("reporterISO")) for row in physical_rows}),
            "estimated_weight_rows": sum(bool(row.get("isNetWgtEstimated")) for row in physical_rows),
            "truncated_responses_accepted": collector_quality.get("truncated_responses_accepted", 0),
        }
    return {
        "as_of": manifest["as_of"],
        "target": manifest["policy"]["current_year_label"],
        "country_universe": total,
        "coverage": {
            "country_rows": {"count": len(mapped_isos & country_isos), "pct": round(100 * len(mapped_isos & country_isos) / total, 1)},
            "oil_profiles": {"count": len(mapped_isos & oil_profiles), "pct": round(100 * len(mapped_isos & oil_profiles) / total, 1)},
            "gas_profiles": {"count": len(mapped_isos & gas_profiles), "pct": round(100 * len(mapped_isos & gas_profiles) / total, 1)},
            "oil_flow_endpoints": {"count": len(mapped_isos & oil_endpoints), "pct": round(100 * len(mapped_isos & oil_endpoints) / total, 1)},
            "gas_flow_endpoints": {"count": len(mapped_isos & gas_endpoints), "pct": round(100 * len(mapped_isos & gas_endpoints) / total, 1)},
            "current_oil_flow_endpoints": {"count": len(mapped_isos & current_oil_endpoints), "pct": round(100 * len(mapped_isos & current_oil_endpoints) / total, 1)},
            "current_gas_flow_endpoints": {"count": len(mapped_isos & current_gas_endpoints), "pct": round(100 * len(mapped_isos & current_gas_endpoints) / total, 1)},
        },
        "records": {
            "countries": len(countries),
            "oil_flows": len(oil_flows),
            "gas_flows": len(gas_flows),
            "current_oil_flows": len(current_oil_flows),
            "current_gas_flows": len(current_gas_flows),
        },
        "source_quality": source_quality,
        "freshness": {
            "current_country_rows": len(oil_current | gas_current),
            "current_oil_profiles": len(oil_current),
            "current_gas_profiles": len(gas_current),
            "fully_current_profiles": len(oil_current & gas_current),
            "stale_country_rows": len(stale_rows),
        },
        "gaps": {
            "missing_country_rows": named(missing_rows),
            "missing_oil_profiles": named(oil_missing),
            "missing_gas_profiles": named(gas_missing),
            "stale_oil_profiles": named(mapped_isos - oil_current),
            "stale_gas_profiles": named(mapped_isos - gas_current),
            "missing_oil_flow_endpoints": named(mapped_isos - oil_endpoints),
            "missing_gas_flow_endpoints": named(mapped_isos - gas_endpoints),
            "missing_current_oil_flow_endpoints": named(mapped_isos - current_oil_endpoints),
            "missing_current_gas_flow_endpoints": named(mapped_isos - current_gas_endpoints),
        },
    }


def _print_human(report: dict[str, Any]) -> None:
    print(f"CrudeMap data coverage — {report['as_of']} — target {report['target']}")
    print(f"Mapped country universe: {report['country_universe']}")
    for label, value in report["coverage"].items():
        print(f"  {label}: {value['count']}/{report['country_universe']} ({value['pct']}%)")
    print(f"  current country rows: {report['freshness']['current_country_rows']}/{report['country_universe']}")
    print(f"  current oil profiles: {report['freshness']['current_oil_profiles']}/{report['country_universe']}")
    print(f"  current gas profiles: {report['freshness']['current_gas_profiles']}/{report['country_universe']}")
    print(f"  fully current oil+gas: {report['freshness']['fully_current_profiles']}/{report['country_universe']}")
    print(f"  stale country rows: {report['freshness']['stale_country_rows']}")
    allocation = report.get("source_quality", {}).get("eurostat_partner_allocation")
    if allocation:
        print(f"  Eurostat mapped-partner allocation: {allocation['allocation_pct']}% of WORLD weight")
    entsog = report.get("source_quality", {}).get("entsog_pipeline_flows")
    if entsog:
        print(
            "  ENTSOG cross-border pipeline corridors: "
            f"{entsog['directed_country_flows']}; "
            f"{entsog['topology_direction_key_use_pct']}% of topology directions active"
        )
    comtrade = report.get("source_quality", {}).get("comtrade_public_preview")
    if comtrade:
        latest = comtrade["periods"][-1] if comtrade["periods"] else "none"
        print(
            "  UN Comtrade public preview: "
            f"{comtrade['usable_physical_rows']} usable rows, "
            f"{comtrade['reporters_with_energy_rows']} reporters, latest {latest}, "
            f"{comtrade['truncated_responses_accepted']} truncated responses accepted"
        )
    for label, rows in report["gaps"].items():
        preview = ", ".join(row["iso"] for row in rows[:20])
        suffix = " ..." if len(rows) > 20 else ""
        print(f"  {label}: {len(rows)} [{preview}{suffix}]")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit CrudeMap data coverage and freshness")
    parser.add_argument("--json", action="store_true", help="Emit the complete machine-readable report")
    parser.add_argument("--strict", action="store_true", help="Fail until every mapped country has current oil/gas profiles and flow coverage")
    args = parser.parse_args()
    report = build_report()
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        _print_human(report)
    if args.strict:
        has_gaps = any(report["gaps"].values()) or report["freshness"]["stale_country_rows"] > 0
        return 1 if has_gaps else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
