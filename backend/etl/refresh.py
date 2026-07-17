"""Materialize refreshed ETL snapshots from normalized upstream exports."""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

from etl.loaders.refresh_loader import RefreshableOilDataLoader
from etl.comtrade_api import fetch_energy_trade_ytd, fetch_energy_trade_ytd_public_preview
from etl.eia_us_flows import fetch_eia_us_flows
from etl.eurostat_comext import fetch_comext_energy_trade, partner_allocation_report
from etl.entsog_flows import fetch_entsog_physical_flows


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh CrudeMap ETL snapshots")
    parser.add_argument(
        "--output-dir",
        default="etl/data/generated",
        help="Directory for generated snapshots when not overwriting seed files",
    )
    parser.add_argument(
        "--write-seed",
        action="store_true",
        help="Overwrite etl/data/countries.json and etl/data/flows.json with refreshed data",
    )
    parser.add_argument(
        "--jodi-oil-year",
        type=int,
        help="Fetch the official JODI Oil primary CSV for this year (for example 2026)",
    )
    parser.add_argument(
        "--jodi-gas",
        action="store_true",
        help="Fetch the latest official JODI Gas CSV publication",
    )
    parser.add_argument(
        "--eia-international-year",
        type=int,
        help="Fetch EIA International annual petroleum country data for this year",
    )
    parser.add_argument(
        "--comtrade-year",
        type=int,
        help="Fetch official monthly bilateral crude oil and LNG trade for this year",
    )
    parser.add_argument(
        "--comtrade-through-month",
        type=int,
        choices=range(1, 13),
        metavar="MONTH",
        help="Last Comtrade month to request (default: previous calendar month)",
    )
    parser.add_argument(
        "--comtrade-from-month",
        type=int,
        choices=range(1, 13),
        metavar="MONTH",
        default=1,
        help="First Comtrade month to request; later months merge with the existing snapshot",
    )
    parser.add_argument(
        "--comtrade-public-preview",
        action="store_true",
        help="Use the official keyless 500-row Preview API with lossless query splitting",
    )
    parser.add_argument(
        "--eia-us-flows",
        action="store_true",
        help="Fetch current EIA U.S. crude oil and natural gas bilateral movement tables",
    )
    parser.add_argument(
        "--eurostat-comext",
        action="store_true",
        help="Fetch current Eurostat Comext crude-oil and LNG bilateral weights",
    )
    parser.add_argument(
        "--eurostat-through-month",
        type=int,
        choices=range(1, 13),
        metavar="MONTH",
        help="Last 2026 Eurostat month to request (default: previous calendar month)",
    )
    parser.add_argument(
        "--entsog",
        action="store_true",
        help="Fetch ENTSOG daily physical cross-border pipeline gas flows for 2026",
    )
    parser.add_argument(
        "--entsog-through-month",
        type=int,
        choices=range(1, 13),
        metavar="MONTH",
        help="Last complete 2026 ENTSOG month to request (default: previous calendar month)",
    )
    args = parser.parse_args()

    if args.jodi_oil_year:
        os.environ["ETL_JODI_URL"] = (
            "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/"
            f"primary/primaryyear{args.jodi_oil_year}.csv"
        )
    if args.jodi_gas:
        request = Request(
            "https://api.publisher.jodidata.org/web/files/gas",
            headers={"User-Agent": "CrudeMap ETL Refresh"},
        )
        with urlopen(request) as response:
            publication = json.loads(response.read().decode("utf-8"))
        csv_file = next(item for item in publication["files"] if item["format"] == "CSV")
        os.environ["ETL_JODI_GAS_URL"] = (
            "https://www.jodidata.org/jodi-publisher/gas/"
            f"{publication['publicationId']}/{csv_file['filename']}"
        )
    if args.eia_international_year:
        os.environ["ETL_EIA_INTERNATIONAL_YEAR"] = str(args.eia_international_year)
        os.environ["ETL_EIA_INTERNATIONAL_URL"] = "https://www.eia.gov/opendata/bulk/INTL.zip"
    if args.comtrade_year:
        api_key = os.getenv("COMTRADE_API_KEY") or os.getenv("ETL_COMTRADE_API_KEY")
        if not api_key and not args.comtrade_public_preview:
            parser.error(
                "--comtrade-year requires COMTRADE_API_KEY or --comtrade-public-preview"
            )
        through_month = args.comtrade_through_month or max(1, date.today().month - 1)
        quality = None
        if api_key:
            rows = fetch_energy_trade_ytd(
                year=args.comtrade_year,
                through_month=through_month,
                api_key=api_key,
            )
        else:
            rows, quality = fetch_energy_trade_ytd_public_preview(
                year=args.comtrade_year,
                through_month=through_month,
                from_month=args.comtrade_from_month,
            )
        source_dir = Path(__file__).parent / "sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        source_path = source_dir / f"comtrade_{args.comtrade_year}_ytd.json"
        if args.comtrade_from_month > 1 and source_path.exists():
            existing_rows = json.loads(source_path.read_text(encoding="utf-8"))
            cutoff = args.comtrade_year * 100 + args.comtrade_from_month
            retained_rows = [
                row for row in existing_rows
                if int(row.get("period") or 0) < cutoff
            ]
            rows = retained_rows + rows
            if quality is not None:
                quality["snapshot_period"] = (
                    f"{args.comtrade_year}-01/{args.comtrade_year}-{through_month:02d}"
                )
                quality["snapshot_raw_rows"] = len(rows)
                quality["incremental_from_month"] = args.comtrade_from_month
        source_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        if quality is not None:
            quality_path = source_dir / f"comtrade_{args.comtrade_year}_quality.json"
            quality_path.write_text(json.dumps(quality, indent=2), encoding="utf-8")
        os.environ["ETL_COMTRADE_FILE"] = str(source_path)
        print(
            f"Fetched UN Comtrade {args.comtrade_year}-{args.comtrade_from_month:02d}/"
            f"{args.comtrade_year}-{through_month:02d}: {len(rows)} rows in merged snapshot"
        )
    if args.eia_us_flows:
        countries_path = Path(__file__).parent / "data" / "countries.json"
        countries = json.loads(countries_path.read_text(encoding="utf-8"))
        rows, unmapped = fetch_eia_us_flows(countries, target_year=2026)
        source_dir = Path(__file__).parent / "sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        source_path = source_dir / "eia_us_flows_2026_ytd.json"
        source_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        os.environ["ETL_EIA_US_FLOWS_FILE"] = str(source_path)
        print(f"Fetched EIA U.S. bilateral movements: {len(rows)} normalized 2026 flows")
        if unmapped:
            print(f"EIA table labels not mapped to countries/areas: {', '.join(sorted(unmapped))}")
    if args.eurostat_comext:
        through_month = args.eurostat_through_month or max(1, date.today().month - 1)
        rows = fetch_comext_energy_trade(year=2026, through_month=through_month)
        source_dir = Path(__file__).parent / "sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        source_path = source_dir / "eurostat_comext_2026_ytd.json"
        source_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        os.environ["ETL_EUROSTAT_COMEXT_FILE"] = str(source_path)
        print(f"Fetched Eurostat Comext 2026-01/2026-{through_month:02d}: {len(rows)} physical trade rows")
        mapping_loader = RefreshableOilDataLoader()
        allocation = partner_allocation_report(rows, set(mapping_loader.country_alpha2_to_iso))
        print(
            "Eurostat mapped-partner allocation: "
            f"{allocation['allocation_pct']:.3f}% of WORLD physical weight"
        )
    if args.entsog:
        through_month = args.entsog_through_month or max(1, date.today().month - 1)
        mapping_loader = RefreshableOilDataLoader()
        rows, quality = fetch_entsog_physical_flows(
            mapping_loader.country_alpha2_to_iso,
            year=2026,
            through_month=through_month,
        )
        source_dir = Path(__file__).parent / "sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        source_path = source_dir / "entsog_flows_2026_ytd.json"
        quality_path = source_dir / "entsog_quality_2026_ytd.json"
        source_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        quality_path.write_text(json.dumps(quality, indent=2), encoding="utf-8")
        os.environ["ETL_ENTSOG_FLOWS_FILE"] = str(source_path)
        print(
            f"Fetched ENTSOG {quality.get('period')}: {quality.get('downloaded_operational_rows', 0)} rows, "
            f"{len(rows)} directed country pipeline flows, "
            f"{quality.get('topology_direction_key_use_pct', 0):.2f}% of topology directions active"
        )

    loader = RefreshableOilDataLoader()
    snapshots = loader.materialize()

    if args.write_seed:
        targets = {
            "countries": Path("etl/data/countries.json"),
            "flows": Path("etl/data/flows.json"),
            "flows_gas": Path("etl/data/flows_gas.json"),
        }
    else:
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        targets = {
            "countries": output_dir / "countries.json",
            "flows": output_dir / "flows.json",
            "flows_gas": output_dir / "flows_gas.json",
        }

    for name, target in targets.items():
        target.write_text(json.dumps(snapshots[name], indent=2), encoding="utf-8")
        print(f"Wrote {name} -> {target}")


if __name__ == "__main__":
    main()
