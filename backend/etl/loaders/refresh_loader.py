"""Refreshable crude-oil loader.

This loader builds canonical country and flow snapshots from normalized source
exports. The upstream source exports can be stored locally as JSON/CSV files or
referenced via URLs through environment variables.

Expected normalized source inputs:
- energy_institute.(json|csv): annual country baseline in Mt/yr
- jodi.(json|csv): newer country patches in the same units as the seed schema
- eia.(json|csv): fallback country values for missing EI fields
- comtrade.(json|csv): crude-only bilateral flows in Mt/yr or tonnes

The loader preserves the existing seed snapshots as a fallback so the app
remains usable even when refresh inputs are incomplete.
"""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from etl.loaders.base import DataLoader
from etl.loaders.json_loader import DATA_DIR, JsonLoader

RAW_SOURCE_NAMES = {
    "energy_institute": ("ETL_EI_FILE", "ETL_EI_URL"),
    "jodi": ("ETL_JODI_FILE", "ETL_JODI_URL"),
    "eia": ("ETL_EIA_FILE", "ETL_EIA_URL"),
    "comtrade": ("ETL_COMTRADE_FILE", "ETL_COMTRADE_URL"),
}

COUNTRY_METRIC_FIELDS = (
    "production_oil_mt",
    "import_oil_mt",
    "export_oil_mt",
    "consumption_oil_mt",
    "refining_capacity_mt",
)

CRUDE_CODES = {"2709", "333", "3330", "crude"}
CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_int(value: Any) -> int | None:
    parsed = _parse_float(value)
    if parsed is None:
        return None
    return int(parsed)


def _slug_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _merge_confidence(current: str | None, new_value: str | None) -> str:
    current_rank = CONFIDENCE_RANK.get(_slug_text(current), 1)
    new_rank = CONFIDENCE_RANK.get(_slug_text(new_value), 1)
    return current if current_rank >= new_rank and current else (new_value or "medium")


def _first(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None


def _source_label(name: str) -> str:
    labels = {
        "energy_institute": "Energy Institute Statistical Review",
        "jodi": "JODI Oil",
        "eia": "EIA Open Data",
        "comtrade": "UN Comtrade",
    }
    return labels.get(name, name.replace("_", " ").title())


class RefreshableOilDataLoader(DataLoader):
    def __init__(
        self,
        source_dir: Path | None = None,
        data_dir: Path | None = None,
        fallback_loader: DataLoader | None = None,
    ) -> None:
        self.source_dir = source_dir or (Path(__file__).parent.parent / "sources")
        self.data_dir = data_dir or DATA_DIR
        self.fallback_loader = fallback_loader or JsonLoader()
        baseline_countries = self.fallback_loader.load_countries()
        self.country_name_to_iso = {
            _slug_text(country["name"]): country["iso"]
            for country in baseline_countries
            if country.get("name") and country.get("iso")
        }

    def describe(self) -> str:
        return "RefreshableOilDataLoader"

    def load_countries(self) -> list[dict]:
        countries = {
            row["iso"]: dict(row)
            for row in self.fallback_loader.load_countries()
            if row.get("iso")
        }

        for record in self._load_country_records("energy_institute"):
            iso = record["iso"]
            current = countries.get(iso, {"iso": iso, "name": record.get("name", iso)})
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("jodi"):
            iso = record["iso"]
            current = countries.get(iso, {"iso": iso, "name": record.get("name", iso)})
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("eia"):
            iso = record["iso"]
            current = countries.get(iso, {"iso": iso, "name": record.get("name", iso)})
            countries[iso] = self._merge_country_record(current, record, override_missing_only=True)

        return sorted(countries.values(), key=lambda row: row["iso"])

    def load_chokepoints(self) -> list[dict]:
        return self.fallback_loader.load_chokepoints()

    def load_infrastructures(self) -> list[dict]:
        return self.fallback_loader.load_infrastructures()

    def load_flows(self) -> list[dict]:
        fallback_flows = self.fallback_loader.load_flows()
        comtrade_records = self._load_flow_records("comtrade")
        if not comtrade_records:
            return fallback_flows

        route_lookup = {
            (row["source_iso"], row["target_iso"]): row.get("via_chokepoints", [])
            for row in fallback_flows
            if row.get("source_iso") and row.get("target_iso")
        }

        flows: list[dict] = []
        for record in comtrade_records:
            route_key = (record["source_iso"], record["target_iso"])
            flows.append(
                {
                    "source_iso": record["source_iso"],
                    "target_iso": record["target_iso"],
                    "volume_mt": record["volume_mt"],
                    "via_chokepoints": record.get("via_chokepoints") or route_lookup.get(route_key, []),
                    "year": record.get("year", 2024),
                    "source": record.get("source") or _source_label("comtrade"),
                    "confidence": record.get("confidence") or "medium",
                }
            )
        return flows

    def load_scenarios(self) -> list[dict]:
        return self.fallback_loader.load_scenarios()

    def materialize(self) -> dict[str, list[dict]]:
        return {
            "countries": self.load_countries(),
            "flows": self.load_flows(),
            "chokepoints": self.load_chokepoints(),
            "infrastructures": self.load_infrastructures(),
            "scenarios": self.load_scenarios(),
        }

    def _merge_country_record(
        self,
        current: dict[str, Any],
        incoming: dict[str, Any],
        *,
        override_missing_only: bool,
    ) -> dict[str, Any]:
        merged = dict(current)
        merged["iso"] = incoming["iso"]
        if incoming.get("name"):
            merged["name"] = incoming["name"]

        for field in ("region", "role", "lat", "lon", "data_level"):
            value = incoming.get(field)
            if value not in (None, "") and (not override_missing_only or not merged.get(field)):
                merged[field] = value

        source_parts = [part.strip() for part in str(merged.get("source", "")).split(" / ") if part.strip()]
        new_source = incoming.get("source")
        if new_source and new_source not in source_parts:
            source_parts.append(new_source)
        if source_parts:
            merged["source"] = " / ".join(source_parts)

        merged["confidence"] = _merge_confidence(merged.get("confidence"), incoming.get("confidence"))
        merged["source_year"] = max(
            merged.get("source_year") or 0,
            incoming.get("source_year") or 0,
        ) or None

        for field in COUNTRY_METRIC_FIELDS:
            value = incoming.get(field)
            if value is None:
                continue
            if override_missing_only and (merged.get(field) or 0) > 0:
                continue
            merged[field] = value

        return merged

    def _load_country_records(self, source_name: str) -> list[dict]:
        raw_records = self._load_raw_records(source_name)
        return [record for record in (self._normalize_country_record(source_name, row) for row in raw_records) if record]

    def _load_flow_records(self, source_name: str) -> list[dict]:
        raw_records = self._load_raw_records(source_name)
        return [record for record in (self._normalize_flow_record(source_name, row) for row in raw_records) if record]

    def _load_raw_records(self, source_name: str) -> list[dict[str, Any]]:
        path = self._resolve_source_path(source_name)
        if path:
            return self._read_records(path)

        url = self._resolve_source_url(source_name)
        if not url:
            return []

        request = Request(url, headers={"User-Agent": "CrudeMap ETL Refresh"})
        with urlopen(request) as response:
            content_type = response.headers.get("Content-Type", "")
            payload = response.read().decode("utf-8")
        return self._read_payload(payload, url, content_type)

    def _resolve_source_path(self, source_name: str) -> Path | None:
        env_file, _ = RAW_SOURCE_NAMES[source_name]
        env_value = os.getenv(env_file)
        if env_value:
            path = Path(env_value)
            if path.exists():
                return path
        for suffix in (".json", ".csv"):
            candidate = self.source_dir / f"{source_name}{suffix}"
            if candidate.exists():
                return candidate
        return None

    def _resolve_source_url(self, source_name: str) -> str | None:
        _, env_url = RAW_SOURCE_NAMES[source_name]
        return os.getenv(env_url)

    def _read_records(self, path: Path) -> list[dict[str, Any]]:
        payload = path.read_text(encoding="utf-8")
        return self._read_payload(payload, path.name, "")

    def _read_payload(self, payload: str, hint: str, content_type: str) -> list[dict[str, Any]]:
        is_json = hint.endswith(".json") or "json" in content_type
        if is_json:
            data = json.loads(payload)
            if isinstance(data, list):
                return [dict(row) for row in data]
            if isinstance(data, dict):
                for key in ("data", "items", "results", "records"):
                    value = data.get(key)
                    if isinstance(value, list):
                        return [dict(row) for row in value]
            raise ValueError(f"Unsupported JSON payload for {hint}")

        reader = csv.DictReader(payload.splitlines())
        return [dict(row) for row in reader]

    def _normalize_country_record(self, source_name: str, row: dict[str, Any]) -> dict[str, Any] | None:
        iso = self._normalize_iso(row)
        if not iso:
            return None

        record: dict[str, Any] = {
            "iso": iso,
            "name": _first(row, "name", "country", "country_name") or row.get("name") or iso,
            "region": _first(row, "region"),
            "role": _first(row, "role"),
            "lat": _parse_float(_first(row, "lat", "latitude")),
            "lon": _parse_float(_first(row, "lon", "longitude")),
            "data_level": _first(row, "data_level") or "A",
            "source": _first(row, "source") or _source_label(source_name),
            "source_year": _parse_int(_first(row, "source_year", "year")),
            "confidence": _first(row, "confidence") or ("high" if source_name == "energy_institute" else "medium"),
        }

        field_aliases = {
            "production_oil_mt": ("production_oil_mt", "production_mt", "production"),
            "import_oil_mt": ("import_oil_mt", "imports_mt", "import_mt", "imports"),
            "export_oil_mt": ("export_oil_mt", "exports_mt", "export_mt", "exports"),
            "consumption_oil_mt": ("consumption_oil_mt", "consumption_mt", "consumption", "demand_mt"),
            "refining_capacity_mt": ("refining_capacity_mt", "refining_mt", "refinery_capacity_mt"),
        }
        for field, aliases in field_aliases.items():
            record[field] = _parse_float(_first(row, *aliases))
        return record

    def _normalize_flow_record(self, source_name: str, row: dict[str, Any]) -> dict[str, Any] | None:
        if not self._is_crude_trade(row):
            return None

        source_iso = self._normalize_iso(row, prefix="source")
        target_iso = self._normalize_iso(row, prefix="target")
        if not source_iso or not target_iso or source_iso == target_iso:
            return None

        volume_mt = _parse_float(_first(row, "volume_mt", "netweight_mt", "trade_value_mt"))
        if volume_mt is None:
            tonnes = _parse_float(_first(row, "netweight_tonnes", "netweight_kg"))
            if tonnes is not None:
                volume_mt = tonnes / 1_000_000.0
        if volume_mt is None or volume_mt <= 0:
            return None

        via = _first(row, "via_chokepoints")
        if isinstance(via, str):
            via_chokepoints = [item.strip() for item in via.split("|") if item.strip()]
        elif isinstance(via, list):
            via_chokepoints = [str(item).strip() for item in via if str(item).strip()]
        else:
            via_chokepoints = []

        return {
            "source_iso": source_iso,
            "target_iso": target_iso,
            "volume_mt": round(volume_mt, 3),
            "via_chokepoints": via_chokepoints,
            "year": _parse_int(_first(row, "year", "trade_year")) or 2024,
            "source": _first(row, "source") or _source_label(source_name),
            "confidence": _first(row, "confidence") or "medium",
        }

    def _normalize_iso(self, row: dict[str, Any], prefix: str | None = None) -> str | None:
        keys = []
        if prefix:
            keys.extend(
                [
                    f"{prefix}_iso",
                    f"{prefix}_iso3",
                    f"{prefix}_code",
                    f"{prefix}_country_iso",
                ]
            )
        keys.extend(["iso", "iso3", "country_iso", "country_code"])
        iso = _first(row, *keys)
        if iso and len(str(iso).strip()) == 3:
            return str(iso).strip().upper()

        name_keys = []
        if prefix:
            name_keys.extend([f"{prefix}_name", f"{prefix}_country"])
        name_keys.extend(["name", "country", "country_name"])
        country_name = _first(row, *name_keys)
        if not country_name:
            return None
        return self.country_name_to_iso.get(_slug_text(country_name))

    def _is_crude_trade(self, row: dict[str, Any]) -> bool:
        product_code = _slug_text(_first(row, "product_code", "commodity_code", "cmd_code", "hs_code", "sitc_code"))
        if product_code:
            if product_code in CRUDE_CODES:
                return True
            if product_code.startswith("2709"):
                return True
            return False

        description = _slug_text(_first(row, "product", "commodity", "commodity_desc", "description"))
        if not description:
            return True
        return "crude" in description and "refined" not in description
