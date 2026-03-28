"""Materialize refreshed ETL snapshots from normalized upstream exports."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from etl.loaders.refresh_loader import RefreshableOilDataLoader


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
    args = parser.parse_args()

    loader = RefreshableOilDataLoader()
    snapshots = loader.materialize()

    if args.write_seed:
        targets = {
            "countries": Path("etl/data/countries.json"),
            "flows": Path("etl/data/flows.json"),
        }
    else:
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        targets = {
            "countries": output_dir / "countries.json",
            "flows": output_dir / "flows.json",
        }

    for name, target in targets.items():
        target.write_text(json.dumps(snapshots[name], indent=2), encoding="utf-8")
        print(f"Wrote {name} -> {target}")


if __name__ == "__main__":
    main()
