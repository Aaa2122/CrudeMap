"""Import Global Energy Monitor (GEM) tracker exports into CrudeMap seeds.

GEM publishes free, high-precision infrastructure datasets (registration
required for download — https://globalenergymonitor.org/projects/):

- Oil & gas pipelines (GOIT / GGIT): routes as GeoJSON LineStrings
- LNG terminals (GGIT): capacities in mtpa, lat/lon
- Oil & gas extraction sites (GOGET): fields with production, lat/lon

Usage (from backend/):
    python -m etl.import_gem --pipelines GEM-pipelines.geojson
    python -m etl.import_gem --lng-terminals GEM-lng.csv
    python -m etl.import_gem --fields GEM-goget.csv
    # add --replace to drop existing curated entries instead of merging

The converter is tolerant of column-name variants, maps GEM statuses to the
seed schema, filters out tiny assets, merges with (or replaces) the curated
seeds in etl/data/, and prints a summary. Run `python -m etl.validate_seeds`
afterwards, then re-seed the database.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Iterable

DATA_DIR = Path(__file__).parent / "data"

MTPA_TO_BCM = 1.36  # 1 mtpa LNG ≈ 1.36 bcm/yr

STATUS_MAP = {
    "operating": "active",
    "operational": "active",
    "in service": "active",
    "construction": "developing",
    "proposed": "developing",
    "announced": "developing",
    "shelved": "offline",
    "cancelled": "offline",
    "idle": "offline",
    "mothballed": "offline",
    "retired": "offline",
    "shut in": "offline",
}


def _first(record: dict[str, Any], *keys: str) -> Any:
    lowered = {str(k).strip().lower(): v for k, v in record.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return None


def _num(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def _status(value: Any) -> str:
    return STATUS_MAP.get(str(value or "").strip().lower(), "active")


def _read_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() in (".geojson", ".json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        features = payload.get("features", payload if isinstance(payload, list) else [])
        rows = []
        for feature in features:
            row = dict(feature.get("properties", {}))
            row["__geometry"] = feature.get("geometry")
            rows.append(row)
        return rows
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return [dict(row) for row in csv.DictReader(fh)]


def _load_seed(name: str) -> list[dict]:
    target = DATA_DIR / name
    if not target.exists():
        return []
    return json.loads(target.read_text(encoding="utf-8"))


def _save_seed(name: str, rows: Iterable[dict]) -> None:
    with open(DATA_DIR / name, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(list(rows), fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def _merge(existing: list[dict], imported: list[dict], replace: bool) -> list[dict]:
    if replace:
        return imported
    seen = {row["name"].strip().lower() for row in imported}
    kept = [row for row in existing if row["name"].strip().lower() not in seen]
    return kept + imported


def convert_pipelines(path: Path, replace: bool) -> None:
    rows = _read_rows(path)
    out: list[dict] = []
    for row in rows:
        geometry = row.get("__geometry")
        if not geometry or geometry.get("type") not in ("LineString", "MultiLineString"):
            continue
        coords = geometry["coordinates"]
        if geometry["type"] == "MultiLineString":
            coords = max(coords, key=len)  # keep the main segment
        if len(coords) < 2:
            continue
        fuel = str(_first(row, "fuel", "commodity", "pipeline type") or "oil").lower()
        commodity = "gas" if "gas" in fuel else "oil"
        cap_raw = _num(_first(row, "capacitybcm/y", "capacity (bcm/y)", "capacity_bcm", "capacityboed", "capacity"))
        name = str(_first(row, "pipelinename", "pipeline name", "name", "projectname") or "").strip()
        if not name:
            continue
        mid = coords[len(coords) // 2]
        out.append({
            "name": name,
            "type": "pipeline",
            "subtype": "gas_pipeline" if commodity == "gas" else "crude_pipeline",
            "country_iso": str(_first(row, "startcountry_iso", "country_iso", "countries") or "")[:3].upper() or None,
            "operator": _first(row, "operator", "owner"),
            "commodity": commodity,
            "capacity_mt": 0.0 if commodity == "gas" else (cap_raw or 0.0),
            "capacity_bcm": cap_raw if commodity == "gas" else None,
            "status": _status(_first(row, "status")),
            "lat": mid[1],
            "lon": mid[0],
            "geometry": {"type": "LineString", "coordinates": coords},
            "source": "GEM Pipeline Tracker",
            "source_year": 2024,
            "confidence": "high",
        })
    merged = _merge(_load_seed("pipelines.json"), out, replace)
    _save_seed("pipelines.json", merged)
    print(f"pipelines.json: imported {len(out)}, total {len(merged)}")


def convert_lng_terminals(path: Path, replace: bool, min_bcm: float) -> None:
    rows = _read_rows(path)
    out: list[dict] = []
    for row in rows:
        lat = _num(_first(row, "latitude", "lat"))
        lon = _num(_first(row, "longitude", "lon", "lng"))
        name = str(_first(row, "terminalname", "terminal name", "name", "project") or "").strip()
        if lat is None or lon is None or not name:
            continue
        cap_mtpa = _num(_first(row, "capacityinmtpa", "capacity (mtpa)", "capacity_mtpa", "capacity"))
        cap_bcm = _num(_first(row, "capacity_bcm", "capacity (bcm/y)")) or (
            cap_mtpa * MTPA_TO_BCM if cap_mtpa else None
        )
        if (cap_bcm or 0) < min_bcm:
            continue
        facility = str(_first(row, "facilitytype", "facility type", "type", "import/export") or "").lower()
        direction = "export" if "export" in facility or "liquefaction" in facility else "import"
        out.append({
            "name": name,
            "type": "lng_terminal",
            "subtype": f"{direction}_terminal",
            "country_iso": str(_first(row, "country_iso", "iso3") or "")[:3].upper() or None,
            "operator": _first(row, "owner", "operator", "parent"),
            "commodity": "gas",
            "capacity_mt": 0.0,
            "capacity_bcm": round(cap_bcm, 1) if cap_bcm else None,
            "status": _status(_first(row, "status")),
            "lat": lat,
            "lon": lon,
            "source": "GEM GGIT",
            "source_year": 2024,
            "confidence": "high",
        })
    merged = _merge(_load_seed("lng_terminals.json"), out, replace)
    _save_seed("lng_terminals.json", merged)
    print(f"lng_terminals.json: imported {len(out)}, total {len(merged)}")


def convert_fields(path: Path, replace: bool, min_mt: float) -> None:
    rows = _read_rows(path)
    out: list[dict] = []
    for row in rows:
        lat = _num(_first(row, "latitude", "lat"))
        lon = _num(_first(row, "longitude", "lon"))
        name = str(_first(row, "unitname", "unit name", "fieldname", "name") or "").strip()
        if lat is None or lon is None or not name:
            continue
        fuel = str(_first(row, "fueldescription", "fuel", "commodity") or "oil").lower()
        commodity = "gas" if "gas" in fuel and "oil" not in fuel else "mixed" if "gas" in fuel else "oil"
        prod_oil = _num(_first(row, "production_oil_mt", "oilproduction (mt)", "production (mt/y)"))
        prod_gas = _num(_first(row, "production_gas_bcm", "gasproduction (bcm)", "production (bcm/y)"))
        if (prod_oil or 0) < min_mt and not prod_gas:
            continue
        out.append({
            "name": name,
            "country_iso": str(_first(row, "country_iso", "iso3") or "")[:3].upper() or None,
            "commodity": commodity,
            "field_type": str(_first(row, "unittype", "type") or "conventional").lower(),
            "production_mt": prod_oil,
            "production_bcm": prod_gas,
            "discovered_year": int(_num(_first(row, "discoveryyear", "discovered")) or 0) or None,
            "status": _status(_first(row, "status")),
            "operator": _first(row, "operator", "owner"),
            "lat": lat,
            "lon": lon,
            "source": "GEM GOGET",
            "source_year": 2024,
            "confidence": "high",
        })
    merged = _merge(_load_seed("fields.json"), out, replace)
    _save_seed("fields.json", merged)
    print(f"fields.json: imported {len(out)}, total {len(merged)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert GEM tracker exports into CrudeMap seeds")
    parser.add_argument("--pipelines", type=Path, help="GEM pipelines GeoJSON (GOIT/GGIT)")
    parser.add_argument("--lng-terminals", type=Path, help="GEM LNG terminals CSV/GeoJSON (GGIT)")
    parser.add_argument("--fields", type=Path, help="GEM extraction sites CSV (GOGET)")
    parser.add_argument("--replace", action="store_true", help="Replace curated entries instead of merging")
    parser.add_argument("--min-bcm", type=float, default=2.0, help="Min LNG terminal capacity (bcm/yr)")
    parser.add_argument("--min-mt", type=float, default=2.0, help="Min field oil production (Mt/yr)")
    args = parser.parse_args()

    if not any([args.pipelines, args.lng_terminals, args.fields]):
        parser.error("nothing to import — pass at least one of --pipelines / --lng-terminals / --fields")

    if args.pipelines:
        convert_pipelines(args.pipelines, args.replace)
    if args.lng_terminals:
        convert_lng_terminals(args.lng_terminals, args.replace, args.min_bcm)
    if args.fields:
        convert_fields(args.fields, args.replace, args.min_mt)

    print("Done. Now run: python -m etl.validate_seeds && python -m etl.seed")


if __name__ == "__main__":
    main()
