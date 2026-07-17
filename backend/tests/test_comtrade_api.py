import json
from unittest.mock import patch

import pytest

from etl.comtrade_api import fetch_energy_trade_month, fetch_energy_trade_ytd_public_preview


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_fetch_energy_trade_month_uses_physical_energy_codes() -> None:
    payload = {"count": 1, "data": [{"cmdCode": "2709", "netWgt": 10}], "error": ""}
    with patch("etl.comtrade_api.urlopen", return_value=FakeResponse(payload)) as opener:
        rows = fetch_energy_trade_month(year=2026, month=4, api_key="test-key")

    assert rows == payload["data"]
    requested_url = opener.call_args.args[0].full_url
    assert "period=202604" in requested_url
    assert "cmdCode=2709%2C271111" in requested_url
    assert "flowCode=M%2CX" in requested_url
    assert "subscription-key=test-key" in requested_url


def test_fetch_energy_trade_month_rejects_api_errors() -> None:
    with patch(
        "etl.comtrade_api.urlopen",
        return_value=FakeResponse({"data": [], "error": "quota exceeded"}),
    ):
        with pytest.raises(RuntimeError, match="quota exceeded"):
            fetch_energy_trade_month(year=2026, month=1, api_key="test-key")


def test_fetch_energy_trade_month_requires_valid_month_and_key() -> None:
    with pytest.raises(ValueError, match="Invalid Comtrade month"):
        fetch_energy_trade_month(year=2026, month=13, api_key="test-key")
    with pytest.raises(ValueError, match="subscription key"):
        fetch_energy_trade_month(year=2026, month=1, api_key="")


def test_public_preview_uses_availability_and_accepts_only_sub_limit_results() -> None:
    availability = {
        "data": [
            {"reporterCode": 24, "reporterISO": "AGO"},
            {"reporterCode": 31, "reporterISO": "AZE"},
        ]
    }
    imports = {"data": [{"reporterISO": "AGO", "partnerISO": "CHN", "cmdCode": "2709"}], "error": ""}
    exports = {"data": [{"reporterISO": "AZE", "partnerISO": "ITA", "cmdCode": "2709"}], "error": ""}
    with patch(
        "etl.comtrade_api._request_payload",
        side_effect=[availability, imports, exports],
    ) as request_payload:
        rows, report = fetch_energy_trade_ytd_public_preview(
            year=2026,
            through_month=1,
            reporter_group_size=5,
        )

    assert len(rows) == 2
    assert report["available_reporter_months"] == 2
    assert report["preview_calls"] == 2
    assert report["truncated_responses_accepted"] == 0
    urls = [call.args[0] for call in request_payload.call_args_list]
    assert "public/v1/getDa" in urls[0]
    assert "reportercode=24%2C31" in urls[1]
    assert "cmdCode=2709%2C271111" in urls[1]


def test_public_preview_rejects_invalid_incremental_range() -> None:
    with pytest.raises(ValueError, match="from month"):
        fetch_energy_trade_ytd_public_preview(
            year=2026,
            from_month=3,
            through_month=2,
        )
