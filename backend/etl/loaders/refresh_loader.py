"""Refreshable crude-oil loader.

This loader builds canonical country and flow snapshots from normalized source
exports. The upstream source exports can be stored locally as JSON/CSV files or
referenced via URLs through environment variables.

Expected normalized source inputs:
- energy_institute.(json|csv): annual country baseline in Mt/yr
- jodi.(json|csv): newer country patches in the same units as the seed schema
- eia.(json|csv): fallback country values for missing EI fields
- comtrade.(json|csv): bilateral crude/LNG trade using physical weight or volume

The loader preserves the existing seed snapshots as a fallback so the app
remains usable even when refresh inputs are incomplete.
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import zipfile
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from etl.loaders.base import DataLoader
from etl.loaders.json_loader import DATA_DIR, JsonLoader

RAW_SOURCE_NAMES = {
    "energy_institute": ("ETL_EI_FILE", "ETL_EI_URL"),
    "eia_international": ("ETL_EIA_INTERNATIONAL_FILE", "ETL_EIA_INTERNATIONAL_URL"),
    "jodi": ("ETL_JODI_FILE", "ETL_JODI_URL"),
    "jodi_gas": ("ETL_JODI_GAS_FILE", "ETL_JODI_GAS_URL"),
    "eia": ("ETL_EIA_FILE", "ETL_EIA_URL"),
    "comtrade": ("ETL_COMTRADE_FILE", "ETL_COMTRADE_URL"),
    "eurostat_comext": ("ETL_EUROSTAT_COMEXT_FILE", "ETL_EUROSTAT_COMEXT_URL"),
    "eia_us_flows": ("ETL_EIA_US_FLOWS_FILE", "ETL_EIA_US_FLOWS_URL"),
    "entsog_flows": ("ETL_ENTSOG_FLOWS_FILE", "ETL_ENTSOG_FLOWS_URL"),
}

COUNTRY_METRIC_FIELDS = (
    "production_oil_mt",
    "import_oil_mt",
    "export_oil_mt",
    "consumption_oil_mt",
    "refining_capacity_mt",
    "production_gas_bcm",
    "import_gas_bcm",
    "export_gas_bcm",
    "consumption_gas_bcm",
)
COUNTRY_SNAPSHOT_FIELDS = (
    "oil_source",
    "oil_confidence",
    "oil_period",
    "oil_data_type",
    "oil_is_partial",
    "gas_source",
    "gas_confidence",
    "gas_period",
    "gas_data_type",
    "gas_is_partial",
)

CRUDE_CODES = {"2709", "333", "3330", "crude"}
LNG_CODES = {"271111", "lng"}
# EIA conversion: 1 million tonnes LNG = 48 billion cubic feet gas;
# 1 cubic foot = 0.02831685 cubic metres. Therefore 1 Mt LNG = 1.3592088 bcm.
LNG_BCM_PER_MT = 48 * 0.02831685
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
        "jodi_gas": "JODI Gas",
        "eia": "EIA Open Data",
        "comtrade": "UN Comtrade",
        "eurostat_comext": "Eurostat Comext",
        "eia_us_flows": "EIA U.S. bilateral movements",
        "entsog_flows": "ENTSOG Transparency Platform",
    }
    return labels.get(name, name.replace("_", " ").title())


def _load_json_rows(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [dict(row) for row in data]


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
        self.baseline_isos = {country["iso"] for country in baseline_countries if country.get("iso")}
        self.country_name_to_iso = {
            _slug_text(country["name"]): country["iso"]
            for country in baseline_countries
            if country.get("name") and country.get("iso")
        }
        self.country_metadata = self._load_country_metadata()
        self.country_alpha2_to_iso = self._load_alpha2_mapping()

    def describe(self) -> str:
        return "RefreshableOilDataLoader"

    def load_countries(self) -> list[dict]:
        countries = {
            row["iso"]: self._with_legacy_snapshot_metadata(row)
            for row in self.fallback_loader.load_countries()
            if row.get("iso")
        }

        for record in self._load_country_records("energy_institute"):
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("eia_international"):
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_geographic_overrides():
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("jodi"):
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("jodi_gas"):
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=False)

        for record in self._load_country_records("eia"):
            iso = record["iso"]
            current = countries.get(iso, self._new_country(record))
            countries[iso] = self._merge_country_record(current, record, override_missing_only=True)

        return sorted(countries.values(), key=lambda row: row["iso"])

    def _load_geographic_overrides(self) -> list[dict[str, Any]]:
        path = self.data_dir / "geographic_overrides.json"
        return _load_json_rows(path) if path.exists() else []

    def _with_legacy_snapshot_metadata(self, row: dict[str, Any]) -> dict[str, Any]:
        country = dict(row)
        source = country.get("source")
        period = str(country["source_year"]) if country.get("source_year") else None
        confidence = country.get("confidence")
        metric_fields = {
            "oil": COUNTRY_METRIC_FIELDS[:5],
            "gas": COUNTRY_METRIC_FIELDS[5:],
        }
        for commodity, fields in metric_fields.items():
            commodity_jodi = f"JODI {commodity.title()}"
            commodity_source = str(country.get(f"{commodity}_source") or "")
            commodity_period = str(country.get(f"{commodity}_period") or "")
            if commodity_period.startswith("2026") and commodity_jodi not in commodity_source:
                # Repair snapshots produced before commodity-specific provenance
                # was enforced: an update for one fuel must never freshen the other.
                country.pop(f"{commodity}_source", None)
                country.pop(f"{commodity}_confidence", None)
                country.pop(f"{commodity}_period", None)
            has_explicit_provenance = bool(country.get(f"{commodity}_source"))
            # Historical seed zeroes may mean either reported zero or unknown.
            # Only attach legacy provenance when at least one metric was present;
            # explicit JODI zeroes already carry commodity-specific provenance.
            has_reported_value = any((country.get(field) or 0) != 0 for field in fields)
            if has_explicit_provenance:
                country.setdefault(f"{commodity}_confidence", confidence or "medium")
                country.setdefault(f"{commodity}_period", period)
            elif has_reported_value:
                legacy_source = str(source or "").split(" / JODI", 1)[0] or "Historical seed baseline"
                country.setdefault(f"{commodity}_source", legacy_source)
                country.setdefault(f"{commodity}_confidence", "medium" if period == "2026" else confidence)
                country.setdefault(f"{commodity}_period", "2024" if period == "2026" else period)
            elif commodity_jodi not in str(country.get(f"{commodity}_source") or ""):
                country.pop(f"{commodity}_source", None)
                country.pop(f"{commodity}_confidence", None)
                country.pop(f"{commodity}_period", None)
            country.setdefault(f"{commodity}_data_type", "annual")
            country.setdefault(f"{commodity}_is_partial", False)
        return country

    def _new_country(self, record: dict[str, Any]) -> dict[str, Any]:
        iso = record["iso"]
        metadata = self.country_metadata.get(iso, {})
        return {
            "iso": iso,
            "name": record.get("name") or metadata.get("name") or iso,
            "region": metadata.get("region"),
            "lat": metadata.get("lat"),
            "lon": metadata.get("lon"),
            "role": "mixed",
            "data_level": "A",
            "production_oil_mt": 0.0,
            "import_oil_mt": 0.0,
            "export_oil_mt": 0.0,
            "consumption_oil_mt": 0.0,
            "refining_capacity_mt": 0.0,
            "production_gas_bcm": 0.0,
            "import_gas_bcm": 0.0,
            "export_gas_bcm": 0.0,
            "consumption_gas_bcm": 0.0,
            "source": record.get("source") or "upstream",
            "source_year": record.get("source_year"),
            "confidence": record.get("confidence") or "medium",
        }

    def load_chokepoints(self) -> list[dict]:
        return self.fallback_loader.load_chokepoints()

    def load_infrastructures(self) -> list[dict]:
        return self.fallback_loader.load_infrastructures()

    def load_flows(self) -> list[dict]:
        fallback_flows = [self._with_legacy_flow_metadata(row) for row in self.fallback_loader.load_flows()]
        monthly_records = self._load_flow_records("comtrade")
        monthly_records.extend(self._load_flow_records("eurostat_comext"))
        refreshed_records = self._aggregate_flow_records(monthly_records)
        refreshed_records.extend(self._load_flow_records("eia_us_flows"))
        refreshed_records.extend(self._load_flow_records("entsog_flows"))
        if not refreshed_records:
            return fallback_flows

        route_lookup = {
            (row["source_iso"], row["target_iso"]): row.get("via_chokepoints", [])
            for row in fallback_flows
            if row.get("source_iso") and row.get("target_iso")
        }

        refreshed_by_key = {
            (row["commodity"], row["source_iso"], row["target_iso"], row.get("transport_mode", "seaborne")): row
            for row in refreshed_records
        }
        preserved_flows = [
            row for row in fallback_flows
            if (row.get("commodity", "oil"), row["source_iso"], row["target_iso"], row.get("transport_mode", "seaborne"))
            not in refreshed_by_key
        ]
        flows: list[dict] = []
        transport_lookup = {
            (row["source_iso"], row["target_iso"]): row.get("transport_mode", "seaborne")
            for row in fallback_flows
        }
        for record in refreshed_by_key.values():
            route_key = (record["source_iso"], record["target_iso"])
            flows.append(
                {
                    "source_iso": record["source_iso"],
                    "target_iso": record["target_iso"],
                    "commodity": record["commodity"],
                    "transport_mode": record.get("transport_mode") or transport_lookup.get(route_key, "seaborne"),
                    "volume_mt": record.get("volume_mt", 0.0),
                    "volume_bcm": record.get("volume_bcm"),
                    "via_chokepoints": record.get("via_chokepoints") or route_lookup.get(route_key, []),
                    "year": record.get("year", 2024),
                    "period": record.get("period"),
                    "data_type": record.get("data_type", "annual"),
                    "is_partial": record.get("is_partial", False),
                    "reporting_basis": record.get("reporting_basis"),
                    "conversion_method": record.get("conversion_method"),
                    "source": record.get("source") or _source_label("comtrade"),
                    "source_url": record.get("source_url"),
                    "confidence": record.get("confidence") or "medium",
                }
            )
        return flows + preserved_flows

    def _with_legacy_flow_metadata(self, row: dict[str, Any]) -> dict[str, Any]:
        flow = dict(row)
        flow.setdefault("commodity", "oil")
        flow.setdefault("transport_mode", "seaborne")
        flow.setdefault("year", 2024)
        flow.setdefault("period", str(flow["year"]))
        flow.setdefault("data_type", "annual")
        flow.setdefault("is_partial", False)
        flow.setdefault("reporting_basis", "curated_estimate")
        flow.setdefault("conversion_method", None)
        flow.setdefault("source_url", None)
        if flow["commodity"] == "oil":
            flow.setdefault("volume_bcm", None)
        return flow

    def _aggregate_flow_records(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Combine Comtrade months, preferring importer reports over mirrors.

        The API consumes annual-rate values, so a partial calendar year is
        annualized against each reporting country's latest loaded month and
        labelled accordingly.
        Missing bilateral rows inside a loaded month are treated as zero trade;
        the snapshot remains explicitly partial because reporter publication
        calendars differ.
        """
        if not any(record.get("data_type") == "monthly" for record in records):
            return records

        result = [record for record in records if record.get("data_type") != "monthly"]
        commodities = {record["commodity"] for record in records if record.get("data_type") == "monthly"}
        for commodity in commodities:
            candidates = [
                record for record in records
                if record.get("data_type") == "monthly" and record["commodity"] == commodity
            ]
            target_year = max(record["year"] for record in candidates)
            candidates = [record for record in candidates if record["year"] == target_year]
            coverage_by_reporter: dict[str, int] = {}
            for record in candidates:
                reporter_iso = str(
                    record.get("reporter_iso")
                    or (record["target_iso"] if record.get("reporting_basis") == "importer_reported" else record["source_iso"])
                )
                month = int(str(record["period"])[5:7])
                coverage_by_reporter[reporter_iso] = max(coverage_by_reporter.get(reporter_iso, 0), month)

            by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
            for record in candidates:
                by_pair.setdefault((record["source_iso"], record["target_iso"]), []).append(record)

            for (source_iso, target_iso), alternatives in by_pair.items():
                importer_rows = [row for row in alternatives if row.get("reporting_basis") == "importer_reported"]
                observations = importer_rows or alternatives
                # When two official systems publish the same reporter/month,
                # prefer Eurostat's EU declaration over the Comtrade mirror.
                best_by_period: dict[str, dict[str, Any]] = {}
                for observation in observations:
                    period = str(observation["period"])
                    priority = 2 if "Eurostat" in str(observation.get("source") or "") else 1
                    current = best_by_period.get(period)
                    current_priority = 2 if current and "Eurostat" in str(current.get("source") or "") else 1
                    if current is None or priority > current_priority:
                        best_by_period[period] = observation
                observations = list(best_by_period.values())
                reporter_iso = str(
                    observations[0].get("reporter_iso")
                    or (target_iso if observations[0].get("reporting_basis") == "importer_reported" else source_iso)
                )
                last_month = coverage_by_reporter[reporter_iso]
                period_label = f"{target_year}-01/{target_year}-{last_month:02d}"
                factor = 12 / last_month
                volume_field = "volume_bcm" if commodity == "gas" else "volume_mt"
                volume = sum(float(row.get(volume_field) or 0) for row in observations) * factor
                bases = {str(row.get("reporting_basis") or "unknown") for row in observations}
                confidences = [str(row.get("confidence") or "medium") for row in observations]
                confidence = min(confidences, key=lambda value: CONFIDENCE_RANK.get(value, 1))
                conversions = sorted({str(row["conversion_method"]) for row in observations if row.get("conversion_method")})
                sources = sorted({str(row.get("source") or "Unknown trade source") for row in observations})
                source_urls = sorted({str(row["source_url"]) for row in observations if row.get("source_url")})
                transport_modes = {str(row.get("transport_mode") or "unspecified") for row in observations}
                result.append(
                    {
                        "source_iso": source_iso,
                        "target_iso": target_iso,
                        "commodity": commodity,
                        "transport_mode": next(iter(transport_modes)) if len(transport_modes) == 1 else "unspecified",
                        "volume_mt": round(volume, 12) if commodity == "oil" else 0.0,
                        "volume_bcm": round(volume, 12) if commodity == "gas" else None,
                        "year": target_year,
                        "period": period_label,
                        "data_type": "annualized_ytd",
                        "is_partial": True,
                        "reporting_basis": next(iter(bases)) if len(bases) == 1 else "mixed_reporter_mirror",
                        "conversion_method": " / ".join(conversions) or None,
                        "source": " / ".join(sources),
                        "source_url": " / ".join(source_urls) or None,
                        "confidence": confidence,
                        "via_chokepoints": [],
                    }
                )
        return result

    def load_fields(self) -> list[dict]:
        return self.fallback_loader.load_fields()

    def load_scenarios(self) -> list[dict]:
        return self.fallback_loader.load_scenarios()

    def materialize(self) -> dict[str, list[dict]]:
        flows = self.load_flows()
        return {
            "countries": self.load_countries(),
            "flows": [row for row in flows if row.get("commodity", "oil") == "oil"],
            "flows_gas": [row for row in flows if row.get("commodity") == "gas"],
            "chokepoints": self.load_chokepoints(),
            "infrastructures": self.load_infrastructures(),
            "fields": self.load_fields(),
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

        for field in ("region", "role", "lat", "lon", "data_level", *COUNTRY_SNAPSHOT_FIELDS):
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
        if source_name == "jodi" and raw_records and "REF_AREA" in raw_records[0]:
            return self._normalize_jodi_oil_records(raw_records)
        if source_name == "jodi_gas" and raw_records and "REF_AREA" in raw_records[0]:
            return self._normalize_jodi_gas_records(raw_records)
        if source_name == "eia_international" and raw_records and "countryRegionId" in raw_records[0]:
            return self._normalize_eia_international_records(raw_records)
        return [record for record in (self._normalize_country_record(source_name, row) for row in raw_records) if record]

    def _normalize_jodi_oil_records(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Aggregate official JODI monthly crude observations to annualized YTD.

        The existing API consumes annual-rate Mt values. We therefore annualize
        the available YTD months and explicitly mark the snapshot partial and
        annualized instead of presenting it as a completed 2026 annual total.
        """
        flow_fields = {
            "INDPROD": "production_oil_mt",
            "TOTIMPSB": "import_oil_mt",
            "TOTEXPSB": "export_oil_mt",
        }
        grouped: dict[str, dict[str, Any]] = {}
        for row in rows:
            if row.get("ENERGY_PRODUCT") != "CRUDEOIL" or row.get("UNIT_MEASURE") != "KTONS":
                continue
            field = flow_fields.get(str(row.get("FLOW_BREAKDOWN")))
            value = _parse_float(row.get("OBS_VALUE"))
            period = str(row.get("TIME_PERIOD") or "")
            iso = self.country_alpha2_to_iso.get(str(row.get("REF_AREA") or "").upper())
            if not field or value is None or not iso or len(period) != 7:
                continue
            item = grouped.setdefault(iso, {"months": set(), "assessment_codes": [], "values": {}})
            item["months"].add(period)
            item["assessment_codes"].append(_parse_int(row.get("ASSESSMENT_CODE")) or 3)
            item["values"].setdefault(field, []).append((period, value))

        records: list[dict[str, Any]] = []
        for iso, item in grouped.items():
            months = sorted(item["months"])
            if not months:
                continue
            record: dict[str, Any] = {
                "iso": iso,
                "source": f"JODI Oil ({months[0]} to {months[-1]}, annualized YTD)",
                "source_year": int(months[-1][:4]),
                "oil_source": "JODI Oil World Database",
                "oil_confidence": "high" if max(item["assessment_codes"]) == 1 else "medium" if max(item["assessment_codes"]) == 2 else "low",
                "oil_period": f"{months[0]}/{months[-1]}",
                "oil_data_type": "annualized_ytd",
                "oil_is_partial": True,
                "confidence": "high" if max(item["assessment_codes"]) == 1 else "medium" if max(item["assessment_codes"]) == 2 else "low",
            }
            for field, observations in item["values"].items():
                observed_months = {period for period, _ in observations}
                if observed_months:
                    # Kton/month summed to YTD, converted to Mt and scaled to a
                    # 12-month run rate. Missing months are not treated as zero.
                    record[field] = round(sum(value for _, value in observations) / 1000 * 12 / len(observed_months), 3)
            records.append(record)
        return records

    def _normalize_eia_international_records(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize EIA's annual petroleum and dry-natural-gas baselines.

        Petroleum is reported in thousand barrels/day and converted using the
        common 7.33 barrels-per-metric-tonne approximation. Dry gas is already
        reported in billion cubic metres. EIA does not expose petroleum exports
        in the selected series, so only that commodity is explicitly partial.
        """
        oil_activity_fields = {
            "1": "production_oil_mt",
            "2": "consumption_oil_mt",
            "3": "import_oil_mt",
        }
        gas_activity_fields = {
            "1": "production_gas_bcm",
            "2": "consumption_gas_bcm",
            "3": "import_gas_bcm",
            "4": "export_gas_bcm",
        }
        oil_periods = [str(row.get("period")) for row in rows if row.get("productId") == "53" and len(str(row.get("period") or "")) == 4]
        gas_periods = [str(row.get("period")) for row in rows if row.get("productId") == "26" and len(str(row.get("period") or "")) == 4]
        if not oil_periods and not gas_periods:
            return []
        oil_target_year = os.getenv("ETL_EIA_INTERNATIONAL_YEAR") or (max(oil_periods) if oil_periods else None)
        gas_target_year = max(gas_periods) if gas_periods else None
        grouped: dict[str, dict[str, Any]] = {}
        for row in rows:
            iso = str(row.get("countryRegionId") or "").upper()
            iso = {"XKS": "KOS"}.get(iso, iso)
            product_id = str(row.get("productId") or "")
            activity_id = str(row.get("activityId") or "")
            field = oil_activity_fields.get(activity_id) if product_id == "53" else gas_activity_fields.get(activity_id) if product_id == "26" else None
            value = _parse_float(row.get("value"))
            target_year = oil_target_year if product_id == "53" else gas_target_year
            expected_unit = "TBPD" if product_id == "53" else "BCM"
            if (
                (iso not in self.country_metadata and iso not in self.baseline_isos)
                or not field
                or row.get("unit") != expected_unit
                or str(row.get("period")) != target_year
                or value is None
            ):
                continue
            record = grouped.setdefault(
                iso,
                {
                    "iso": iso,
                    "source": "EIA International annual energy baseline",
                    "source_year": int(target_year),
                    "confidence": "high" if not row.get("dataFlagId") else "medium",
                },
            )
            if row.get("countryRegionName"):
                record["name"] = row["countryRegionName"]
            record["source_year"] = max(record.get("source_year") or 0, int(target_year))
            if product_id == "53":
                record.update(
                    {
                        "oil_source": "EIA International (production, consumption and imports; exports retain prior baseline)",
                        "oil_confidence": "high" if not row.get("dataFlagId") else "medium",
                        "oil_period": f"{target_year} (mixed trade baseline)",
                        "oil_data_type": "mixed",
                        "oil_is_partial": True,
                    }
                )
                # thousand b/d * 365 / 7.33 / 1000 = million tonnes/year
                record[field] = round(value * 365 / 7.33 / 1000, 3)
            else:
                record.update(
                    {
                        "gas_source": "EIA International dry natural gas balance",
                        "gas_confidence": "high" if not row.get("dataFlagId") else "medium",
                        "gas_period": target_year,
                        "gas_data_type": "annual",
                        "gas_is_partial": False,
                    }
                )
                record[field] = round(value, 3)
        return list(grouped.values())

    def _normalize_jodi_gas_records(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Aggregate the latest JODI Gas year to an explicitly annualized YTD snapshot."""
        periods = [
            str(row.get("TIME_PERIOD"))
            for row in rows
            if row.get("ENERGY_PRODUCT") == "NATGAS" and len(str(row.get("TIME_PERIOD") or "")) == 7
        ]
        if not periods:
            return []
        target_year = os.getenv("ETL_JODI_GAS_YEAR") or max(periods)[:4]
        flow_fields = {
            "INDPROD": "production_gas_bcm",
            "TOTIMPSB": "import_gas_bcm",
            "TOTEXPSB": "export_gas_bcm",
            "TOTDEMO": "consumption_gas_bcm",
            "TOTDEMC": "consumption_gas_bcm",
        }
        observed_demand = {
            (row.get("REF_AREA"), row.get("TIME_PERIOD"))
            for row in rows
            if row.get("ENERGY_PRODUCT") == "NATGAS"
            and row.get("FLOW_BREAKDOWN") == "TOTDEMO"
            and row.get("UNIT_MEASURE") == "M3"
            and _parse_float(row.get("OBS_VALUE")) is not None
            and str(row.get("TIME_PERIOD") or "").startswith(f"{target_year}-")
        }
        grouped: dict[str, dict[str, Any]] = {}
        for row in rows:
            period = str(row.get("TIME_PERIOD") or "")
            flow = str(row.get("FLOW_BREAKDOWN") or "")
            if (
                row.get("ENERGY_PRODUCT") != "NATGAS"
                or row.get("UNIT_MEASURE") != "M3"
                or not period.startswith(f"{target_year}-")
            ):
                continue
            if flow == "TOTDEMC" and (row.get("REF_AREA"), row.get("TIME_PERIOD")) in observed_demand:
                continue
            field = flow_fields.get(flow)
            value = _parse_float(row.get("OBS_VALUE"))
            iso = self.country_alpha2_to_iso.get(str(row.get("REF_AREA") or "").upper())
            if not field or value is None or not iso:
                continue
            item = grouped.setdefault(iso, {"months": set(), "assessment_codes": [], "values": {}})
            item["months"].add(period)
            item["assessment_codes"].append(_parse_int(row.get("ASSESSMENT_CODE")) or 3)
            item["values"].setdefault(field, []).append((period, value))

        records: list[dict[str, Any]] = []
        for iso, item in grouped.items():
            months = sorted(item["months"])
            if not months:
                continue
            record: dict[str, Any] = {
                "iso": iso,
                "source": f"JODI Gas ({months[0]} to {months[-1]}, annualized YTD)",
                "source_year": int(target_year),
                "gas_source": "JODI Gas World Database",
                "gas_confidence": "high" if max(item["assessment_codes"]) == 1 else "medium" if max(item["assessment_codes"]) == 2 else "low",
                "gas_period": f"{months[0]}/{months[-1]}",
                "gas_data_type": "annualized_ytd",
                "gas_is_partial": True,
                "confidence": "high" if max(item["assessment_codes"]) == 1 else "medium" if max(item["assessment_codes"]) == 2 else "low",
            }
            for field, observations in item["values"].items():
                observed_months = {period for period, _ in observations}
                if observed_months:
                    # JODI M3 is million cubic metres. Sum YTD, convert to bcm,
                    # then scale to a 12-month annual rate.
                    record[field] = round(sum(value for _, value in observations) / 1000 * 12 / len(observed_months), 3)
            records.append(record)
        return records

    def _load_alpha2_mapping(self) -> dict[str, str]:
        mapping: dict[str, str] = {}
        map_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "world-countries.geojson"
        if map_path.exists():
            data = json.loads(map_path.read_text(encoding="utf-8"))
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                alpha2 = props.get("ISO_A2")
                alpha3 = props.get("ISO_A3")
                if alpha2 and alpha2 != "-99" and alpha3 and alpha3 != "-99":
                    mapping[str(alpha2).upper()] = str(alpha3).upper()
        # JODI/ISO edge cases not represented cleanly in the Natural Earth file.
        mapping.update({"FR": "FRA", "NO": "NOR", "XK": "KOS"})
        return mapping

    def _load_country_metadata(self) -> dict[str, dict[str, Any]]:
        metadata: dict[str, dict[str, Any]] = {}
        map_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "world-countries.geojson"
        if not map_path.exists():
            return metadata
        data = json.loads(map_path.read_text(encoding="utf-8"))
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            iso = props.get("ISO_A3")
            if not iso or iso == "-99":
                iso = props.get("ADM0_A3")
            if not iso or iso == "-99":
                continue
            metadata[str(iso).upper()] = {
                "name": props.get("NAME_EN") or props.get("NAME") or iso,
                "region": props.get("REGION_UN") or props.get("CONTINENT"),
                "lat": props.get("LABEL_Y"),
                "lon": props.get("LABEL_X"),
            }
        return metadata

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
            payload = response.read()
        return self._read_bytes(payload, url, content_type)

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
        return self._read_bytes(path.read_bytes(), path.name, "")

    def _read_bytes(self, payload: bytes, hint: str, content_type: str) -> list[dict[str, Any]]:
        is_zip = hint.lower().endswith(".zip") or "zip" in content_type or payload.startswith(b"PK\x03\x04")
        if is_zip:
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
                if csv_names:
                    with archive.open(csv_names[0]) as source:
                        text = io.TextIOWrapper(source, encoding="utf-8-sig")
                        return [dict(row) for row in csv.DictReader(text)]
                intl_names = [name for name in archive.namelist() if name.upper() == "INTL.TXT"]
                if intl_names:
                    return self._read_eia_intl_bulk(archive, intl_names[0])
                raise ValueError(f"No supported data file found in ZIP payload for {hint}")
        return self._read_payload(payload.decode("utf-8-sig"), hint, content_type)

    def _read_eia_intl_bulk(self, archive: zipfile.ZipFile, name: str) -> list[dict[str, Any]]:
        """Project the 128 MB EIA bulk file to the few annual series CrudeMap needs."""
        patterns = (
            (re.compile(r"^INTL\.53-([123])-([A-Z]{3})-TBPD\.A$"), "53", "TBPD"),
            (re.compile(r"^INTL\.26-([1234])-([A-Z]{3})-BCM\.A$"), "26", "BCM"),
        )
        rows: list[dict[str, Any]] = []
        with archive.open(name) as source:
            text = io.TextIOWrapper(source, encoding="utf-8")
            for line in text:
                if '"series_id":"INTL.' not in line or not ("-TBPD.A" in line or "-BCM.A" in line):
                    continue
                series = json.loads(line)
                series_id = str(series.get("series_id") or "")
                matched = next(
                    ((match, product_id, unit) for pattern, product_id, unit in patterns if (match := pattern.match(series_id))),
                    None,
                )
                if not matched:
                    continue
                match, product_id, unit = matched
                activity_id, iso = match.groups()
                for period, value in series.get("data", []):
                    rows.append(
                        {
                            "period": str(period),
                            "productId": product_id,
                            "activityId": activity_id,
                            "countryRegionId": iso,
                            "unit": unit,
                            "value": value,
                        }
                    )
        return rows

    def _read_payload(self, payload: str, hint: str, content_type: str) -> list[dict[str, Any]]:
        is_json = hint.endswith(".json") or "json" in content_type
        if is_json:
            data = json.loads(payload)
            if isinstance(data, list):
                return [dict(row) for row in data]
            if isinstance(data, dict):
                response = data.get("response")
                if isinstance(response, dict) and isinstance(response.get("data"), list):
                    return [dict(row) for row in response["data"]]
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

        if source_name in {"energy_institute", "jodi", "eia"}:
            record.update(
                {
                    "oil_source": record["source"],
                    "oil_period": str(record["source_year"]) if record["source_year"] else None,
                    "oil_data_type": "annual",
                    "oil_is_partial": False,
                    "oil_confidence": record["confidence"],
                }
            )

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
        commodity = self._trade_commodity(row)
        if not commodity:
            return None

        flow_code = str(_first(row, "flowCode", "flow_code", "tradeFlowCode") or "").upper()
        reporter_iso = self._normalize_iso_value(_first(row, "reporterISO", "reporter_iso", "reporterCodeISO"))
        partner_iso = self._normalize_iso_value(_first(row, "partnerISO", "partner_iso", "partnerCodeISO"))
        reporting_basis = _first(row, "reporting_basis")
        if flow_code in {"M", "X", "IMPORT", "EXPORT"} and reporter_iso and partner_iso:
            is_import = flow_code in {"M", "IMPORT"}
            source_iso, target_iso = (partner_iso, reporter_iso) if is_import else (reporter_iso, partner_iso)
            reporting_basis = "importer_reported" if is_import else "exporter_reported"
        else:
            source_iso = self._normalize_iso(row, prefix="source")
            target_iso = self._normalize_iso(row, prefix="target")
        if not source_iso or not target_iso or source_iso == target_iso:
            return None
        known_isos = self.baseline_isos | set(self.country_metadata)
        if source_iso not in known_isos or target_iso not in known_isos:
            return None

        volume_mt = _parse_float(_first(row, "volume_mt", "netweight_mt"))
        conversion_method = _first(row, "conversion_method")
        if volume_mt is None:
            tonnes = _parse_float(_first(row, "netweight_tonnes", "net_weight_tonnes"))
            if tonnes is not None:
                volume_mt = tonnes / 1_000_000
                conversion_method = "reported net weight tonnes / 1e6"
        if volume_mt is None:
            kilograms = _parse_float(_first(row, "netWgt", "netweight_kg", "net_weight_kg"))
            if kilograms is not None:
                volume_mt = kilograms / 1_000_000_000
                conversion_method = "reported net weight kg / 1e9"

        volume_bcm = _parse_float(_first(row, "volume_bcm"))
        if commodity == "gas" and volume_bcm is None and volume_mt is not None:
            volume_bcm = volume_mt * LNG_BCM_PER_MT
            conversion_method = (
                "reported LNG net weight; EIA 48 Bcf/Mt and 0.02831685 bcm/Bcf"
            )
        physical_volume = volume_bcm if commodity == "gas" else volume_mt
        if physical_volume is None or physical_volume <= 0:
            return None

        via = _first(row, "via_chokepoints")
        if isinstance(via, str):
            via_chokepoints = [item.strip() for item in via.split("|") if item.strip()]
        elif isinstance(via, list):
            via_chokepoints = [str(item).strip() for item in via if str(item).strip()]
        else:
            via_chokepoints = []

        raw_period = str(_first(row, "period", "refPeriodId", "trade_period", "year", "trade_year") or "")
        digits = re.sub(r"\D", "", raw_period)
        if re.fullmatch(r"\d{4}-\d{2}(?:-\d{2})?/\d{4}-\d{2}(?:-\d{2})?", raw_period):
            period = raw_period
            data_type = str(_first(row, "data_type") or "annualized_ytd")
            is_partial = True if _first(row, "is_partial") is None else bool(_first(row, "is_partial"))
        elif len(digits) >= 6:
            period = f"{digits[:4]}-{digits[4:6]}"
            data_type = str(_first(row, "data_type") or "monthly")
            is_partial = True if _first(row, "is_partial") is None else bool(_first(row, "is_partial"))
        else:
            period = digits[:4] or raw_period or None
            data_type = str(_first(row, "data_type") or "annual")
            is_partial = bool(_first(row, "is_partial") or False)
        year = _parse_int(_first(row, "year", "trade_year")) or (_parse_int(digits[:4]) if digits else None) or 2024
        confidence = str(_first(row, "confidence") or ("medium" if commodity == "gas" else "high"))
        if bool(_first(row, "isNetWgtEstimated", "is_net_weight_estimated")):
            confidence = "medium"

        return {
            "source_iso": source_iso,
            "target_iso": target_iso,
            "commodity": commodity,
            "transport_mode": str(_first(row, "transport_mode") or "seaborne"),
            "volume_mt": round(volume_mt or 0, 12) if commodity == "oil" else 0.0,
            "volume_bcm": round(volume_bcm, 12) if volume_bcm is not None else None,
            "via_chokepoints": via_chokepoints,
            "year": year,
            "period": period,
            "data_type": data_type,
            "is_partial": is_partial,
            "reporting_basis": reporting_basis,
            "reporter_iso": reporter_iso,
            "conversion_method": conversion_method,
            "source": _first(row, "source") or f"{_source_label(source_name)} HS {'271111' if commodity == 'gas' else '2709'}",
            "source_url": _first(row, "source_url") or (
                "https://comtradeplus.un.org/" if source_name == "comtrade"
                else "https://ec.europa.eu/eurostat/web/international-trade-in-goods/database" if source_name == "eurostat_comext"
                else None
            ),
            "confidence": confidence,
        }

    def _normalize_iso_value(self, value: Any) -> str | None:
        if not value:
            return None
        iso = str(value).strip().upper()
        if len(iso) == 2:
            iso = {"EL": "GRC", "UK": "GBR", "XK": "KOS"}.get(iso, self.country_alpha2_to_iso.get(iso, ""))
        iso = {"XKX": "KOS", "XKS": "KOS"}.get(iso, iso)
        return iso if len(iso) == 3 else None

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
        return self._trade_commodity(row) == "oil"

    def _trade_commodity(self, row: dict[str, Any]) -> str | None:
        product_code = _slug_text(_first(row, "product_code", "commodity_code", "cmd_code", "hs_code", "sitc_code"))
        if not product_code:
            product_code = _slug_text(_first(row, "cmdCode"))
        if product_code:
            if product_code in CRUDE_CODES:
                return "oil"
            if product_code.startswith("2709"):
                return "oil"
            if product_code in LNG_CODES or product_code.startswith("271111"):
                return "gas"
            return None

        description = _slug_text(_first(row, "product", "commodity", "commodity_desc", "description"))
        if not description:
            return "oil"
        if "liquefied natural gas" in description or description == "lng":
            return "gas"
        if description in {"gas", "natural gas", "pipeline gas"}:
            return "gas"
        if "crude" in description and "refined" not in description:
            return "oil"
        return None
