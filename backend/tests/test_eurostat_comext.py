from unittest.mock import patch

import pytest

from etl.eurostat_comext import SDMX_CSV, fetch_comext_energy_trade, partner_allocation_report


class FakeResponse:
    def __init__(self, payload: str) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.payload.encode("utf-8")


def test_fetch_comext_converts_100kg_to_reported_net_weight_kg() -> None:
    payload = (
        "DATAFLOW,LAST UPDATE,freq,reporter,partner,product,flow,indicators,TIME_PERIOD,OBS_VALUE\n"
        "ESTAT:DS-045409(1.0),16/07/26 11:00:00,M,DE,US,2709,1,QUANTITY_IN_100KG,2026-04,123.45\n"
        "ESTAT:DS-045409(1.0),16/07/26 11:00:00,M,FR,QA,271111,2,QUANTITY_IN_100KG,2026-04,10\n"
    )
    with patch("etl.eurostat_comext.urlopen", return_value=FakeResponse(payload)) as opener:
        rows = fetch_comext_energy_trade(year=2026, through_month=4)

    assert rows[0]["netWgt"] == 12_345
    assert rows[0]["flowCode"] == "M"
    assert rows[0]["transport_mode"] == "unspecified"
    assert rows[1]["netWgt"] == 1_000
    assert rows[1]["flowCode"] == "X"
    assert rows[1]["transport_mode"] == "seaborne"
    request = opener.call_args.args[0]
    assert request.headers["Accept"] == SDMX_CSV
    assert "endPeriod=2026-04" in request.full_url


def test_fetch_comext_rejects_invalid_month_and_empty_payload() -> None:
    with pytest.raises(ValueError, match="Invalid Eurostat"):
        fetch_comext_energy_trade(year=2026, through_month=0)
    header = "reporter,partner,product,flow,TIME_PERIOD,OBS_VALUE\n"
    with patch("etl.eurostat_comext.urlopen", return_value=FakeResponse(header)):
        with pytest.raises(RuntimeError, match="no energy trade rows"):
            fetch_comext_energy_trade(year=2026, through_month=4)


def test_partner_allocation_reconciles_country_rows_against_world() -> None:
    rows = [
        {"reporterISO": "DE", "cmdCode": "2709", "flowCode": "M", "period": "2026-01", "partnerISO": "WORLD", "netWgt": 1000},
        {"reporterISO": "DE", "cmdCode": "2709", "flowCode": "M", "period": "2026-01", "partnerISO": "NO", "netWgt": 800},
        {"reporterISO": "DE", "cmdCode": "2709", "flowCode": "M", "period": "2026-01", "partnerISO": "QW", "netWgt": 200},
    ]

    report = partner_allocation_report(rows, {"NO"})

    assert report["allocation_pct"] == 80.0
    assert report["unallocated_kg"] == 200.0
