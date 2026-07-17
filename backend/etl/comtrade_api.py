"""Official UN Comtrade monthly bilateral trade client for CrudeMap."""

from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


COMTRADE_ENDPOINT = "https://comtradeapi.un.org/data/v1/get/C/M/HS"
COMTRADE_PREVIEW_ENDPOINT = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"
COMTRADE_AVAILABILITY_ENDPOINT = "https://comtradeapi.un.org/public/v1/getDa/C/M/HS"
MAX_RECORDS = 250_000
PREVIEW_MAX_RECORDS = 500
PUBLIC_REQUEST_INTERVAL_SECONDS = 1.1
_last_public_request_at = 0.0


def _request_payload(url: str, *, throttle_public: bool = False) -> dict[str, Any]:
    global _last_public_request_at
    for attempt in range(5):
        if throttle_public:
            remaining = PUBLIC_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_public_request_at)
            if remaining > 0:
                time.sleep(remaining)
        try:
            request = Request(url, headers={"User-Agent": "CrudeMap ETL Refresh"})
            with urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if throttle_public:
                _last_public_request_at = time.monotonic()
            return payload
        except HTTPError as exc:
            if exc.code != 429 or attempt == 4:
                body = exc.read().decode("utf-8", errors="replace")[:1000]
                raise RuntimeError(
                    f"UN Comtrade HTTP {exc.code} for {url}: {body}"
                ) from exc
            retry_after = float(exc.headers.get("Retry-After") or 2 ** (attempt + 1))
            time.sleep(min(retry_after, 30))
        except (URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("UN Comtrade API request failed after controlled retries")


def fetch_energy_trade_month(
    *,
    year: int,
    month: int,
    api_key: str,
) -> list[dict[str, Any]]:
    """Fetch crude oil and LNG imports/exports for one calendar month.

    Both reporter directions are retained. The refresh loader subsequently
    prefers importer-reported observations and uses exporter reports only as
    mirrors where the importer did not report the same bilateral month.
    """
    if not 1 <= month <= 12:
        raise ValueError(f"Invalid Comtrade month: {month}")
    if not api_key.strip():
        raise ValueError("A UN Comtrade API subscription key is required")

    query = urlencode(
        {
            "period": f"{year}{month:02d}",
            "cmdCode": "2709,271111",
            "flowCode": "M,X",
            "partner2Code": "0",
            "customsCode": "C00",
            "motCode": "0",
            "maxRecords": str(MAX_RECORDS),
            "format": "JSON",
            "breakdownMode": "classic",
            "includeDesc": "true",
            "subscription-key": api_key.strip(),
        }
    )
    payload = _request_payload(f"{COMTRADE_ENDPOINT}?{query}")

    error = str(payload.get("error") or "").strip()
    if error:
        raise RuntimeError(f"UN Comtrade rejected {year}-{month:02d}: {error}")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise RuntimeError(f"UN Comtrade returned no data list for {year}-{month:02d}")
    if len(rows) >= MAX_RECORDS:
        raise RuntimeError(
            f"UN Comtrade result reached the {MAX_RECORDS:,}-record limit for "
            f"{year}-{month:02d}; split the request before using it"
        )
    return [dict(row) for row in rows]


def fetch_energy_trade_ytd(*, year: int, through_month: int, api_key: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for month in range(1, through_month + 1):
        rows.extend(fetch_energy_trade_month(year=year, month=month, api_key=api_key))
    return rows


def _fetch_public_group(
    *,
    period: str,
    reporter_codes: list[int],
    flow_code: str,
    cmd_codes: list[str],
    stats: dict[str, int],
) -> list[dict[str, Any]]:
    query = urlencode(
        {
            "period": period,
            "reportercode": ",".join(str(code) for code in reporter_codes),
            "cmdCode": ",".join(cmd_codes),
            "flowCode": flow_code,
            "partner2Code": "0",
            "customsCode": "C00",
            "motCode": "0",
            "maxRecords": str(PREVIEW_MAX_RECORDS),
            "format": "JSON",
            "breakdownMode": "classic",
            "includeDesc": "true",
        }
    )
    stats["preview_calls"] += 1
    payload = _request_payload(
        f"{COMTRADE_PREVIEW_ENDPOINT}?{query}",
        throttle_public=True,
    )
    error = str(payload.get("error") or "").strip()
    if error:
        raise RuntimeError(f"UN Comtrade Preview rejected {period}: {error}")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise RuntimeError(f"UN Comtrade Preview returned no data list for {period}")
    if len(rows) < PREVIEW_MAX_RECORDS:
        return [dict(row) for row in rows]

    # A preview result at the hard limit may be truncated. Split reporters first,
    # then commodities, until every accepted response is demonstrably below 500.
    stats["split_responses"] += 1
    if len(reporter_codes) > 1:
        midpoint = len(reporter_codes) // 2
        return _fetch_public_group(
            period=period,
            reporter_codes=reporter_codes[:midpoint],
            flow_code=flow_code,
            cmd_codes=cmd_codes,
            stats=stats,
        ) + _fetch_public_group(
            period=period,
            reporter_codes=reporter_codes[midpoint:],
            flow_code=flow_code,
            cmd_codes=cmd_codes,
            stats=stats,
        )
    if len(cmd_codes) > 1:
        return sum(
            (
                _fetch_public_group(
                    period=period,
                    reporter_codes=reporter_codes,
                    flow_code=flow_code,
                    cmd_codes=[cmd_code],
                    stats=stats,
                )
                for cmd_code in cmd_codes
            ),
            [],
        )
    raise RuntimeError(
        f"UN Comtrade Preview still reaches 500 records for reporter "
        f"{reporter_codes[0]}, {period}, {flow_code}, {cmd_codes[0]}"
    )


def fetch_energy_trade_ytd_public_preview(
    *,
    year: int,
    through_month: int,
    from_month: int = 1,
    reporter_group_size: int = 10,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Fetch all published 2026 reporter-months without a subscription key.

    The official Preview API is capped at 500 rows. Reporter groups are split
    recursively whenever that cap is reached, so truncated responses are never
    silently accepted.
    """
    if not 1 <= through_month <= 12:
        raise ValueError(f"Invalid Comtrade through month: {through_month}")
    if not 1 <= from_month <= through_month:
        raise ValueError(f"Invalid Comtrade from month: {from_month}")
    if reporter_group_size < 1:
        raise ValueError("reporter_group_size must be positive")

    rows: list[dict[str, Any]] = []
    stats = {"availability_calls": 0, "preview_calls": 0, "split_responses": 0}
    reporter_months = 0
    reporters: set[str] = set()
    months_with_data: list[str] = []
    for month in range(from_month, through_month + 1):
        period = f"{year}{month:02d}"
        stats["availability_calls"] += 1
        availability = _request_payload(
            f"{COMTRADE_AVAILABILITY_ENDPOINT}?{urlencode({'period': period})}",
            throttle_public=True,
        )
        available_rows = availability.get("data")
        if not isinstance(available_rows, list):
            raise RuntimeError(f"UN Comtrade returned no availability list for {period}")
        codes = sorted(
            {
                int(item["reporterCode"])
                for item in available_rows
                if item.get("reporterCode") is not None
            }
        )
        if not codes:
            continue
        months_with_data.append(period)
        reporter_months += len(codes)
        for start in range(0, len(codes), reporter_group_size):
            group = codes[start : start + reporter_group_size]
            for flow_code in ("M", "X"):
                group_rows = _fetch_public_group(
                    period=period,
                    reporter_codes=group,
                    flow_code=flow_code,
                    cmd_codes=["2709", "271111"],
                    stats=stats,
                )
                rows.extend(group_rows)
                reporters.update(
                    str(row.get("reporterISO"))
                    for row in group_rows
                    if row.get("reporterISO")
                )
    report: dict[str, Any] = {
        **stats,
        "period": f"{year}-{from_month:02d}/{year}-{through_month:02d}",
        "months_with_published_data": months_with_data,
        "available_reporter_months": reporter_months,
        "reporters_with_energy_rows": len(reporters),
        "raw_rows": len(rows),
        "record_limit": PREVIEW_MAX_RECORDS,
        "truncated_responses_accepted": 0,
    }
    return rows, report
