"""Read-only sanity checks for the seed datasets in etl/data/.

Usage (from backend/):
    python -m etl.validate_seeds

Exits non-zero if any check fails. Run after editing seed JSON files.
"""
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

VALID_COMMODITIES = {"oil", "gas", "mixed", "products"}
VALID_TRANSPORT = {"seaborne", "pipeline"}
VALID_STATUS = {"active", "limited", "offline", "producing", "declining", "developing"}

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def check_coords(label: str, lat, lon) -> None:
    if lat is None or lon is None:
        err(f"{label}: missing lat/lon")
        return
    if not (-90 <= lat <= 90):
        err(f"{label}: lat {lat} out of range")
    # lon may exceed 180 for antimeridian-unwrapped geometries, never below -180
    if not (-180 <= lon <= 360):
        err(f"{label}: lon {lon} out of range")


def main() -> int:
    countries = load("countries.json")
    isos = {c["iso"] for c in countries}
    chokepoints = {c["slug"] for c in load("chokepoints.json")}

    for c in countries:
        check_coords(f"country {c['iso']}", c.get("lat"), c.get("lon"))
        for key in ("production_gas_bcm", "import_gas_bcm", "export_gas_bcm", "consumption_gas_bcm"):
            if key not in c:
                err(f"country {c['iso']}: missing {key}")

    for fname in ("flows.json", "flows_gas.json"):
        for f in load(fname):
            label = f"{fname} {f['source_iso']}->{f['target_iso']}"
            if f["source_iso"] not in isos:
                err(f"{label}: unknown source ISO")
            if f["target_iso"] not in isos:
                err(f"{label}: unknown target ISO")
            if f.get("commodity") not in VALID_COMMODITIES:
                err(f"{label}: bad commodity {f.get('commodity')}")
            if f.get("transport_mode") not in VALID_TRANSPORT:
                err(f"{label}: bad transport_mode {f.get('transport_mode')}")
            for slug in f.get("via_chokepoints", []):
                if slug not in chokepoints:
                    err(f"{label}: unknown chokepoint {slug}")
            if f.get("commodity") == "gas" and not f.get("volume_bcm"):
                err(f"{label}: gas flow without volume_bcm")
            if f.get("commodity") == "oil" and not f.get("volume_mt"):
                err(f"{label}: oil flow without volume_mt")

    seen_names: set[str] = set()
    for fname in ("infrastructures.json", "pipelines.json", "lng_terminals.json"):
        for i in load(fname):
            label = f"{fname} {i['name']}"
            if i["name"] in seen_names:
                err(f"{label}: duplicate name")
            seen_names.add(i["name"])
            if i.get("country_iso") and i["country_iso"] not in isos:
                err(f"{label}: unknown ISO {i['country_iso']}")
            if i.get("commodity") not in VALID_COMMODITIES:
                err(f"{label}: bad commodity {i.get('commodity')}")
            if i.get("status") not in VALID_STATUS:
                err(f"{label}: bad status {i.get('status')}")
            check_coords(label, i.get("lat"), i.get("lon"))
            geom = i.get("geometry")
            if fname == "pipelines.json":
                if not geom or geom.get("type") != "LineString" or len(geom.get("coordinates", [])) < 2:
                    err(f"{label}: pipeline without valid LineString geometry")
                else:
                    for lon, lat in geom["coordinates"]:
                        check_coords(f"{label} geometry point", lat, lon)

    for f in load("fields.json"):
        label = f"fields.json {f['name']}"
        if f["country_iso"] not in isos:
            err(f"{label}: unknown ISO {f['country_iso']}")
        if f.get("commodity") not in VALID_COMMODITIES:
            err(f"{label}: bad commodity")
        if f.get("status") not in VALID_STATUS:
            err(f"{label}: bad status")
        if f.get("production_mt") is None and f.get("production_bcm") is None:
            err(f"{label}: no production value")
        check_coords(label, f.get("lat"), f.get("lon"))

    if errors:
        print(f"FAILED — {len(errors)} problem(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    counts = {
        name: len(load(name))
        for name in (
            "countries.json", "flows.json", "flows_gas.json", "fields.json",
            "pipelines.json", "lng_terminals.json", "infrastructures.json",
            "chokepoints.json", "scenarios.json",
        )
    }
    print("OK —", ", ".join(f"{k}: {v}" for k, v in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
