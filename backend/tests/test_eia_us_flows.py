import pytest

from etl.eia_us_flows import parse_eia_bilateral_table


def _row(label: str, values: list[str]) -> str:
    cells = "".join(
        f'<td width="76" class="{"Current2" if index == len(values) - 1 else "DataB"}">{value}</td>'
        for index, value in enumerate(values)
    )
    return (
        '<tr class="DataRow"><td><table><tr>'
        f'<td class="DataStub1">{label}</td></tr></table></td>{cells}</tr>'
    )


def test_gas_table_ignores_price_section_and_reconciles_total() -> None:
    page = "".join(
        [
            '<th class="Series5">Nov-25</th><th class="Series5">Dec-25</th>',
            '<th class="Series5">Jan-26</th><th class="Series5">Feb-26</th>',
            _row("Total", ["0", "0", "100", "200"]),
            _row("Canada", ["0", "0", "100", "200"]),
            _row("Export Prices", ["0", "0", "2.5", "3.5"]),
            _row("Canada", ["0", "0", "2.5", "3.5"]),
        ]
    )

    records, unmapped = parse_eia_bilateral_table(
        page,
        commodity="gas",
        direction="export",
        countries=[{"iso": "CAN", "name": "Canada"}],
        source_url="https://example.test/eia",
    )

    assert not unmapped
    assert len(records) == 1
    assert records[0]["source_iso"] == "USA"
    assert records[0]["target_iso"] == "CAN"
    assert records[0]["volume_bcm"] == 0.051
    assert records[0]["period"] == "2026-01/2026-02"
    assert records[0]["transport_mode"] == "pipeline"


def test_country_sum_must_reconcile_to_published_total() -> None:
    page = "".join(
        [
            '<th class="Series5">Jan-26</th>',
            _row("Total All Countries", ["1000"]),
            _row("Canada", ["100"]),
        ]
    )

    with pytest.raises(ValueError, match="does not reconcile"):
        parse_eia_bilateral_table(
            page,
            commodity="oil",
            direction="import",
            countries=[{"iso": "CAN", "name": "Canada"}],
            source_url="https://example.test/eia",
        )
