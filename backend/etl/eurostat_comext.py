"""Eurostat Comext monthly crude-oil and LNG bilateral trade client."""

from __future__ import annotations

import csv
import io
from typing import Any
from urllib.request import Request, urlopen


COMEXT_ENDPOINT = (
    "https://ec.europa.eu/eurostat/api/comext/dissemination/sdmx/2.1/data/"
    "DS-045409/M...2709+271111.1+2.QUANTITY_IN_100KG"
)
COMEXT_SOURCE_URL = "https://ec.europa.eu/eurostat/web/international-trade-in-goods/database"
SDMX_CSV = "application/vnd.sdmx.data+csv;version=1.0.0"


def partner_allocation_report(rows: list[dict[str, Any]], valid_alpha2: set[str]) -> dict[str, float]:
    """Reconcile mapped bilateral partners against Comext WORLD totals."""
    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    for row in rows:
        key = (
            str(row.get("reporterISO")),
            str(row.get("cmdCode")),
            str(row.get("flowCode")),
            str(row.get("period")),
        )
        grouped.setdefault(key, []).append(row)
    world_kg = 0.0
    allocated_kg = 0.0
    for group in grouped.values():
        world = sum(float(row.get("netWgt") or 0) for row in group if row.get("partnerISO") == "WORLD")
        if world <= 0:
            continue
        world_kg += world
        allocated_kg += sum(
            float(row.get("netWgt") or 0)
            for row in group
            if str(row.get("partnerISO") or "") in valid_alpha2
        )
    return {
        "world_kg": world_kg,
        "allocated_partner_kg": allocated_kg,
        "unallocated_kg": max(0.0, world_kg - allocated_kg),
        "allocation_pct": round(100 * allocated_kg / world_kg, 3) if world_kg else 0.0,
    }


def fetch_comext_energy_trade(*, year: int, through_month: int) -> list[dict[str, Any]]:
    """Fetch all available European reporter/partner crude and LNG weights."""
    if not 1 <= through_month <= 12:
        raise ValueError(f"Invalid Eurostat through month: {through_month}")
    url = (
        f"{COMEXT_ENDPOINT}?startPeriod={year}-01&endPeriod={year}-{through_month:02d}"
    )
    request = Request(
        url,
        headers={"Accept": SDMX_CSV, "User-Agent": "CrudeMap ETL Refresh"},
    )
    with urlopen(request, timeout=180) as response:
        payload = response.read().decode("utf-8-sig")

    rows: list[dict[str, Any]] = []
    for row in csv.DictReader(io.StringIO(payload)):
        try:
            weight_100kg = float(str(row.get("OBS_VALUE") or ""))
        except ValueError:
            continue
        flow_code = str(row.get("flow") or "")
        if weight_100kg <= 0 or flow_code not in {"1", "2"}:
            continue
        rows.append(
            {
                "period": row.get("TIME_PERIOD"),
                "reporterISO": row.get("reporter"),
                "partnerISO": row.get("partner"),
                "flowCode": "M" if flow_code == "1" else "X",
                "cmdCode": row.get("product"),
                "netWgt": weight_100kg * 100,
                "transport_mode": "seaborne" if row.get("product") == "271111" else "unspecified",
                "source": "Eurostat Comext DS-045409",
                "source_url": COMEXT_SOURCE_URL,
                "confidence": "high",
                "last_update": row.get("LAST UPDATE"),
            }
        )
    if not rows:
        raise RuntimeError(f"Eurostat Comext returned no energy trade rows for {year}")
    return rows
