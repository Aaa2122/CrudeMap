"""ENTSOG Transparency Platform physical cross-border gas-flow client."""

from __future__ import annotations

import json
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_URL = "https://transparency.entsog.eu/api/v1"
SOURCE_URL = "https://transparency.entsog.eu/"
KWH_PER_CUBIC_METRE = 10.55


@dataclass(frozen=True)
class DirectedRoute:
    source_iso: str
    target_iso: str
    reporting_basis: str


def _as_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [dict(item) for item in value]
    if isinstance(value, dict):
        return [dict(value)]
    return []


def _request_json(url: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "CrudeMap ETL Refresh"})
            with urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError("ENTSOG API request failed after controlled retries") from last_error


def _fetch_pages(
    endpoint: str,
    params: dict[str, Any],
    *,
    collection: str,
    limit: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    for _page in range(100):
        query = dict(params)
        query.update({"limit": limit, "offset": offset})
        payload = _request_json(f"{BASE_URL}/{endpoint}?{urlencode(query)}")
        page_rows = _as_list(payload.get(collection) or payload.get(collection.rstrip("s")))
        rows.extend(page_rows)
        raw_page_size = int((payload.get("meta") or {}).get("total") or len(page_rows))
        if raw_page_size < limit:
            return rows
        offset += limit
    raise RuntimeError(f"ENTSOG pagination safety limit reached for {endpoint}")


def fetch_interconnections() -> list[dict[str, Any]]:
    return _fetch_pages("interconnections", {}, collection="interconnections", limit=1000)


def build_direction_routes(
    interconnections: list[dict[str, Any]],
    alpha2_to_iso: dict[str, str],
) -> dict[tuple[str, str, str], DirectedRoute]:
    """Map an operator/point/direction tuple to a directed country flow."""
    routes: dict[tuple[str, str, str], DirectedRoute] = {}
    ambiguous: set[tuple[str, str, str]] = set()
    for item in interconnections:
        if (
            item.get("fromInfrastructureTypeLabel") != "Transmission"
            or item.get("toInfrastructureTypeLabel") != "Transmission"
        ):
            continue
        from_iso = alpha2_to_iso.get(str(item.get("fromCountryKey") or "").upper())
        to_iso = alpha2_to_iso.get(str(item.get("toCountryKey") or "").upper())
        if not from_iso or not to_iso or from_iso == to_iso:
            continue
        for prefix, country_iso, other_iso in (
            ("from", from_iso, to_iso),
            ("to", to_iso, from_iso),
        ):
            operator = str(item.get(f"{prefix}OperatorKey") or "")
            point = str(item.get(f"{prefix}PointKey") or item.get("pointKey") or "")
            direction = str(item.get(f"{prefix}DirectionKey") or "").lower()
            if not operator or not point or direction not in {"entry", "exit"}:
                continue
            if direction == "entry":
                route = DirectedRoute(other_iso, country_iso, "operator_entry")
            else:
                route = DirectedRoute(country_iso, other_iso, "operator_exit")
            key = (operator, point, direction)
            if key in routes and routes[key] != route:
                ambiguous.add(key)
            else:
                routes[key] = route
    for key in ambiguous:
        routes.pop(key, None)
    return routes


def aggregate_physical_flows(
    observations: list[dict[str, Any]],
    routes: dict[tuple[str, str, str], DirectedRoute],
    *,
    year: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Deduplicate both sides of each border point and annualize daily energy."""
    candidates: dict[tuple[str, str, date, str], list[tuple[DirectedRoute, float]]] = defaultdict(list)
    valid_rows = 0
    mapped_rows = 0
    observed_route_keys: set[tuple[str, str, str]] = set()
    for row in observations:
        if row.get("unit") != "kWh/d" or row.get("indicator") != "Physical Flow":
            continue
        try:
            value = float(row.get("value"))
            day = datetime.fromisoformat(str(row.get("periodFrom"))).date()
        except (TypeError, ValueError):
            continue
        if value <= 0 or day.year != year:
            continue
        valid_rows += 1
        key = (
            str(row.get("operatorKey") or ""),
            str(row.get("pointKey") or ""),
            str(row.get("directionKey") or "").lower(),
        )
        route = routes.get(key)
        if not route:
            continue
        mapped_rows += 1
        observed_route_keys.add(key)
        candidate_key = (route.source_iso, route.target_iso, day, str(row.get("pointKey") or ""))
        candidates[candidate_key].append((route, value))

    selected: list[tuple[str, str, date, str, float, str]] = []
    for (source_iso, target_iso, day, point), alternatives in candidates.items():
        entry = [item for item in alternatives if item[0].reporting_basis == "operator_entry"]
        chosen = entry or alternatives
        selected.append(
            (
                source_iso,
                target_iso,
                day,
                point,
                sum(item[1] for item in chosen),
                "operator_entry" if entry else "operator_exit",
            )
        )
    if not selected:
        return [], {
            "positive_physical_rows": valid_rows,
            "cross_border_rows_matched": mapped_rows,
            "cross_border_share_of_all_positive_pct": 0.0,
            "topology_direction_keys_observed": 0,
            "topology_direction_key_use_pct": 0.0,
        }

    last_day = max(item[2] for item in selected)
    first_day = date(year, 1, 1)
    elapsed_days = (last_day - first_day).days + 1
    by_pair: dict[tuple[str, str], list[tuple[str, str, date, str, float, str]]] = defaultdict(list)
    for item in selected:
        by_pair[(item[0], item[1])].append(item)

    flows: list[dict[str, Any]] = []
    for (source_iso, target_iso), rows in sorted(by_pair.items()):
        annual_kwh = sum(row[4] for row in rows) * 365 / elapsed_days
        volume_bcm = annual_kwh / (KWH_PER_CUBIC_METRE * 1_000_000_000)
        if volume_bcm <= 0:
            continue
        bases = {row[5] for row in rows}
        flows.append(
            {
                "source_iso": source_iso,
                "target_iso": target_iso,
                "commodity": "gas",
                "transport_mode": "pipeline",
                "volume_mt": 0.0,
                "volume_bcm": round(volume_bcm, 9),
                "year": year,
                "period": f"{first_day.isoformat()}/{last_day.isoformat()}",
                "data_type": "annualized_ytd",
                "is_partial": True,
                "reporting_basis": next(iter(bases)) if len(bases) == 1 else "mixed_operator_sides",
                "conversion_method": (
                    "ENTSOG daily kWh/d averaged over elapsed calendar days; "
                    f"{KWH_PER_CUBIC_METRE} kWh per standard m3"
                ),
                "source": "ENTSOG Transparency Platform physical flow",
                "source_url": SOURCE_URL,
                "confidence": "medium",
                "coverage_days": len({row[2] for row in rows}),
                "points_count": len({row[3] for row in rows}),
            }
        )
    report = {
        "positive_physical_rows": valid_rows,
        "cross_border_rows_matched": mapped_rows,
        # The denominator includes storage, LNG, production and consumer points;
        # this is a composition statistic, not a cross-border completeness rate.
        "cross_border_share_of_all_positive_pct": (
            round(100 * mapped_rows / valid_rows, 2) if valid_rows else 0.0
        ),
        "topology_direction_keys_observed": len(observed_route_keys),
        "topology_direction_key_use_pct": (
            round(100 * len(observed_route_keys) / len(routes), 2) if routes else 0.0
        ),
        "selected_point_days": len(selected),
        "directed_country_flows": len(flows),
        "period": f"{first_day.isoformat()}/{last_day.isoformat()}",
    }
    return flows, report


def fetch_entsog_physical_flows(
    alpha2_to_iso: dict[str, str],
    *,
    year: int,
    through_month: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not 1 <= through_month <= 12:
        raise ValueError(f"Invalid ENTSOG through month: {through_month}")
    interconnections = fetch_interconnections()
    routes = build_direction_routes(interconnections, alpha2_to_iso)
    observations: list[dict[str, Any]] = []
    for month in range(1, through_month + 1):
        next_month = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
        month_end = next_month - timedelta(days=1)
        observations.extend(
            _fetch_pages(
                "operationaldatas",
                {
                    "from": f"{year}-{month:02d}-01",
                    "to": month_end.isoformat(),
                    "indicator": "Physical Flow",
                    "periodType": "day",
                    "timeZone": "WET",
                    "includeExemptions": 0,
                },
                collection="operationaldatas",
                limit=10_000,
            )
        )
    flows, report = aggregate_physical_flows(observations, routes, year=year)
    report.update(
        {
            "interconnections": len(interconnections),
            "direction_routes": len(routes),
            "downloaded_operational_rows": len(observations),
        }
    )
    return flows, report
