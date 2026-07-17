"""Parse current U.S. bilateral oil and gas movements from official EIA tables."""

from __future__ import annotations

import html as html_lib
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from typing import Any
from urllib.request import Request, urlopen


EIA_TABLES = (
    ("oil", "import", "https://www.eia.gov/dnav/pet/PET_MOVE_IMPCUS_A2_NUS_EPC0_IM0_MBBL_M.htm"),
    ("oil", "export", "https://www.eia.gov/dnav/pet/PET_MOVE_EXPC_A_EPC0_EEX_MBBL_M.htm"),
    ("gas", "import", "https://www.eia.gov/dnav/ng/NG_MOVE_IMPC_S1_M.htm"),
    ("gas", "export", "https://www.eia.gov/dnav/ng/NG_MOVE_EXPC_S1_M.htm"),
)

COUNTRY_ALIASES = {
    "antigua and barbuda": "ATG",
    "bahamas": "BHS",
    "bahama islands": "BHS",
    "barbados": "BRB",
    "bolivia": "BOL",
    "brunei": "BRN",
    "burma": "MMR",
    "china hong kong special administrative region": "HKG",
    "congo brazzaville": "COG",
    "congo kinshasa": "COD",
    "cote divoire": "CIV",
    "czech republic": "CZE",
    "gambia the": "GMB",
    "iran": "IRN",
    "ivory coast": "CIV",
    "korea north": "PRK",
    "korea south": "KOR",
    "laos": "LAO",
    "moldova": "MDA",
    "republic of congo": "COG",
    "russia": "RUS",
    "swaziland": "SWZ",
    "syria": "SYR",
    "taiwan": "TWN",
    "tanzania": "TZA",
    "turkey": "TUR",
    "turkiye": "TUR",
    "venezuela": "VEN",
    "vietnam": "VNM",
}

NON_COUNTRY_LABELS = {
    "all countries",
    "by truck",
    "by vessel",
    "cng",
    "exports",
    "lng",
    "non opec",
    "opec",
    "persian gulf",
    "pipeline",
    "total",
    "total all countries",
}

ROW_SPLIT_RE = re.compile(r'<tr\s+class="DataRow"[^>]*>', re.IGNORECASE)
STUB_RE = re.compile(r'class="DataStub\d*"[^>]*>(.*?)</td>', re.IGNORECASE | re.DOTALL)
VALUE_RE = re.compile(r'class="(?:DataB|Current2)"[^>]*>(.*?)</td>', re.IGNORECASE | re.DOTALL)
PERIOD_RE = re.compile(r'class="Series5"[^>]*>([^<]+)</th>', re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")


def _text(fragment: str) -> str:
    return " ".join(html_lib.unescape(TAG_RE.sub(" ", fragment)).replace("\xa0", " ").split())


def _key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _country_lookup(countries: list[dict[str, Any]]) -> dict[str, str]:
    lookup = {_key(str(row["name"])): str(row["iso"]) for row in countries if row.get("name") and row.get("iso")}
    lookup.update(COUNTRY_ALIASES)
    return lookup


def parse_eia_bilateral_table(
    page: str,
    *,
    commodity: str,
    direction: str,
    countries: list[dict[str, Any]],
    source_url: str,
    target_year: int = 2026,
) -> tuple[list[dict[str, Any]], set[str]]:
    """Return canonical annualized-YTD flows and positive unmapped row labels."""
    raw_periods = PERIOD_RE.findall(page)
    periods = [datetime.strptime(value.strip(), "%b-%y").strftime("%Y-%m") for value in raw_periods]
    target_indexes = [index for index, period in enumerate(periods) if period.startswith(str(target_year))]
    if not target_indexes:
        return [], set()

    country_lookup = _country_lookup(countries)
    volumes: dict[str, float] = defaultdict(float)
    unmapped: set[str] = set()
    published_total_ytd: float | None = None
    in_price_section = False
    for block in ROW_SPLIT_RE.split(page)[1:]:
        stubs = [_text(value) for value in STUB_RE.findall(block)]
        if not stubs:
            continue
        label = stubs[-1]
        if "price" in label.lower():
            in_price_section = True
            continue
        if commodity == "gas" and in_price_section:
            continue
        raw_values = VALUE_RE.findall(block)
        if len(raw_values) < len(periods):
            continue
        values: list[float] = []
        for index in target_indexes:
            value = _text(raw_values[index]).replace(",", "")
            try:
                values.append(float(value))
            except ValueError:
                values.append(0.0)
        total = sum(values)
        if total <= 0:
            continue
        if _key(label) in {"all countries", "total", "total all countries"} and published_total_ytd is None:
            published_total_ytd = total
            continue
        iso = country_lookup.get(_key(label))
        if not iso:
            # Section totals and transport labels are expected to be unmapped;
            # retain positive labels for audit so country aliases can be added.
            if _key(label).replace("*", "") not in NON_COUNTRY_LABELS:
                unmapped.add(label)
            continue
        volumes[iso] += total

    first_period = periods[target_indexes[0]]
    last_period = periods[target_indexes[-1]]
    annualization = 12 / len(target_indexes)
    records: list[dict[str, Any]] = []
    for partner_iso, ytd_value in sorted(volumes.items()):
        source_iso, target_iso = (
            (partner_iso, "USA") if direction == "import" else ("USA", partner_iso)
        )
        if source_iso == target_iso:
            continue
        if commodity == "oil":
            # Source unit is thousand barrels/month.
            volume_mt = ytd_value / 7.33 / 1000 * annualization
            volume_bcm = None
            conversion = "EIA thousand barrels / 7.33 bbl per tonne / 1000; annualized YTD"
        else:
            # Source unit is million cubic feet/month.
            volume_mt = 0.0
            volume_bcm = ytd_value * 0.00002831685 * annualization
            conversion = "EIA million cubic feet × 0.00002831685 bcm; annualized YTD"
        records.append(
            {
                "source_iso": source_iso,
                "target_iso": target_iso,
                "commodity_code": "271111" if commodity == "gas" else "2709",
                "commodity": commodity,
                "transport_mode": "pipeline" if commodity == "gas" and partner_iso in {"CAN", "MEX"} else "seaborne",
                "volume_mt": round(volume_mt, 3),
                "volume_bcm": round(volume_bcm, 3) if volume_bcm is not None else None,
                "year": target_year,
                "period": f"{first_period}/{last_period}",
                "data_type": "annualized_ytd",
                "is_partial": True,
                "reporting_basis": "importer_reported" if direction == "import" else "exporter_reported",
                "conversion_method": conversion,
                "source": f"EIA U.S. {'crude oil' if commodity == 'oil' else 'natural gas'} {direction}s by country",
                "source_url": source_url,
                "confidence": "high",
            }
        )
    if published_total_ytd is not None:
        if commodity == "oil":
            published_total = published_total_ytd / 7.33 / 1000 * annualization
            computed_total = sum(float(record["volume_mt"]) for record in records)
        else:
            published_total = published_total_ytd * 0.00002831685 * annualization
            computed_total = sum(float(record["volume_bcm"] or 0) for record in records)
        tolerance = max(0.05, published_total * 0.005)
        if abs(computed_total - published_total) > tolerance:
            raise ValueError(
                f"EIA {commodity} {direction} country sum {computed_total:.3f} does not "
                f"reconcile to published total {published_total:.3f}"
            )
    return records, unmapped


def fetch_eia_us_flows(countries: list[dict[str, Any]], *, target_year: int = 2026) -> tuple[list[dict[str, Any]], set[str]]:
    records: list[dict[str, Any]] = []
    unmapped: set[str] = set()
    for commodity, direction, url in EIA_TABLES:
        request = Request(url, headers={"User-Agent": "CrudeMap ETL Refresh"})
        with urlopen(request, timeout=60) as response:
            page = response.read().decode("utf-8", errors="replace")
        parsed, page_unmapped = parse_eia_bilateral_table(
            page,
            commodity=commodity,
            direction=direction,
            countries=countries,
            source_url=url,
            target_year=target_year,
        )
        records.extend(parsed)
        unmapped.update(page_unmapped)
    return records, unmapped
