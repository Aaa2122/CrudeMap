import json
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from etl.loaders.base import DataLoader
from etl.loaders.refresh_loader import RefreshableOilDataLoader


class FixtureLoader(DataLoader):
    def load_countries(self) -> list[dict]:
        return [
            {
                "iso": "USA",
                "name": "United States",
                "region": "North America",
                "role": "mixed",
                "lat": 38.0,
                "lon": -97.0,
                "production_oil_mt": 900.0,
                "import_oil_mt": 300.0,
                "export_oil_mt": 250.0,
                "consumption_oil_mt": 850.0,
                "refining_capacity_mt": 800.0,
                "source": "seed",
                "source_year": 2024,
                "confidence": "medium",
                "data_level": "B",
            },
            {
                "iso": "CAN",
                "name": "Canada",
                "region": "North America",
                "role": "exporter",
                "lat": 56.0,
                "lon": -106.0,
                "production_oil_mt": 300.0,
                "import_oil_mt": 50.0,
                "export_oil_mt": 200.0,
                "consumption_oil_mt": 100.0,
                "refining_capacity_mt": 90.0,
                "source": "seed",
                "source_year": 2024,
                "confidence": "medium",
                "data_level": "B",
            },
        ]

    def load_chokepoints(self) -> list[dict]:
        return []

    def load_infrastructures(self) -> list[dict]:
        return []

    def load_flows(self) -> list[dict]:
        return [
            {
                "source_iso": "USA",
                "target_iso": "CAN",
                "volume_mt": 10.0,
                "via_chokepoints": ["panama"],
                "source": "seed",
                "confidence": "medium",
            }
        ]

    def load_fields(self) -> list[dict]:
        return []

    def load_scenarios(self) -> list[dict]:
        return []


class RefreshableLoaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.source_dir = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_json(self, name: str, rows: list[dict]) -> None:
        (self.source_dir / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")

    def test_alpha2_mapping_repairs_natural_earth_minus_99_countries(self) -> None:
        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        self.assertEqual(loader.country_alpha2_to_iso["FR"], "FRA")
        self.assertEqual(loader.country_alpha2_to_iso["NO"], "NOR")
        self.assertEqual(loader.country_alpha2_to_iso["XK"], "KOS")

    def test_country_normalization_and_patch_fallback(self) -> None:
        self._write_json(
            "energy_institute",
            [
                {
                    "country_name": "United States",
                    "production_mt": 1000,
                    "import_mt": 390,
                    "export_mt": 420,
                    "consumption_mt": 930,
                    "refining_mt": 920,
                    "source_year": 2025,
                },
                {
                    "iso": "CAN",
                    "production_mt": 310,
                    "import_mt": 55,
                    "export_mt": 220,
                    "consumption_mt": 110,
                    "source_year": 2025,
                },
            ],
        )
        self._write_json(
            "jodi",
            [
                {
                    "iso": "USA",
                    "import_oil_mt": 405,
                    "source_year": 2026,
                    "source": "JODI Oil Jan 2026",
                    "confidence": "high",
                }
            ],
        )
        self._write_json(
            "eia",
            [
                {
                    "iso": "CAN",
                    "refining_capacity_mt": 95,
                    "source_year": 2025,
                    "source": "EIA 2025",
                }
            ],
        )

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        countries = {row["iso"]: row for row in loader.load_countries()}

        self.assertEqual(countries["USA"]["import_oil_mt"], 405.0)
        self.assertEqual(countries["USA"]["production_oil_mt"], 1000.0)
        self.assertEqual(countries["USA"]["source_year"], 2026)
        self.assertIn("JODI Oil Jan 2026", countries["USA"]["source"])
        self.assertEqual(countries["CAN"]["production_oil_mt"], 310.0)
        self.assertEqual(countries["CAN"]["refining_capacity_mt"], 90.0)

    def test_missing_monthly_patch_keeps_annual_baseline(self) -> None:
        self._write_json(
            "energy_institute",
            [{"iso": "CAN", "production_mt": 315, "source_year": 2025}],
        )
        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        countries = {row["iso"]: row for row in loader.load_countries()}
        self.assertEqual(countries["CAN"]["production_oil_mt"], 315.0)
        self.assertEqual(countries["CAN"]["import_oil_mt"], 50.0)
        self.assertEqual(countries["CAN"]["oil_period"], "2025")
        self.assertNotIn("gas_period", countries["CAN"])

    def test_explicit_zero_profile_keeps_provenance_across_refreshes(self) -> None:
        class ExplicitZeroFixture(FixtureLoader):
            def load_countries(self) -> list[dict]:
                rows = super().load_countries()
                rows[0].update(
                    {
                        "production_gas_bcm": 0.0,
                        "import_gas_bcm": 0.0,
                        "export_gas_bcm": 0.0,
                        "consumption_gas_bcm": 0.0,
                        "gas_source": "EIA International dry natural gas balance",
                        "gas_period": "2024",
                        "gas_confidence": "high",
                    }
                )
                return rows

        usa = {
            row["iso"]: row
            for row in RefreshableOilDataLoader(
                source_dir=self.source_dir,
                fallback_loader=ExplicitZeroFixture(),
            ).load_countries()
        }["USA"]

        self.assertEqual(usa["gas_source"], "EIA International dry natural gas balance")
        self.assertEqual(usa["gas_period"], "2024")

    def test_materialize_keeps_oil_and_gas_flow_snapshots_separate(self) -> None:
        class MixedFlowFixture(FixtureLoader):
            def load_flows(self) -> list[dict]:
                return super().load_flows() + [{
                    "source_iso": "CAN",
                    "target_iso": "USA",
                    "commodity": "gas",
                    "transport_mode": "pipeline",
                    "volume_mt": 0.0,
                    "volume_bcm": 10.0,
                    "via_chokepoints": [],
                    "year": 2024,
                }]

        snapshots = RefreshableOilDataLoader(
            source_dir=self.source_dir,
            fallback_loader=MixedFlowFixture(),
        ).materialize()

        self.assertEqual(len(snapshots["flows"]), 1)
        self.assertEqual(len(snapshots["flows_gas"]), 1)
        self.assertEqual(snapshots["flows_gas"][0]["commodity"], "gas")

    def test_crude_flow_filtering_and_route_fallback(self) -> None:
        self._write_json(
            "comtrade",
            [
                {
                    "source_iso": "USA",
                    "target_iso": "CAN",
                    "commodity_code": "2709",
                    "netweight_tonnes": 12000000,
                    "year": 2025,
                },
                {
                    "source_iso": "USA",
                    "target_iso": "CAN",
                    "commodity_code": "2710",
                    "netweight_tonnes": 99999999,
                    "year": 2025,
                },
            ],
        )
        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        flows = loader.load_flows()
        self.assertEqual(len(flows), 1)
        self.assertEqual(flows[0]["volume_mt"], 12.0)
        self.assertEqual(flows[0]["via_chokepoints"], ["panama"])

    def test_comtrade_net_weight_kg_is_converted_to_million_tonnes(self) -> None:
        self._write_json(
            "comtrade",
            [{
                "source_iso": "USA",
                "target_iso": "CAN",
                "cmdCode": "2709",
                "netweight_kg": 1_000_000_000,
                "year": 2025,
            }],
        )

        flow = RefreshableOilDataLoader(
            source_dir=self.source_dir,
            fallback_loader=FixtureLoader(),
        ).load_flows()[0]

        self.assertEqual(flow["volume_mt"], 1.0)
        self.assertEqual(flow["conversion_method"], "reported net weight kg / 1e9")

    def test_comtrade_months_annualize_crude_and_lng_and_prefer_importer_report(self) -> None:
        self._write_json(
            "comtrade",
            [
                {"period": 202601, "reporterISO": "CAN", "partnerISO": "USA", "flowCode": "M", "cmdCode": "2709", "netWgt": 1_000_000_000},
                {"period": 202602, "reporterISO": "CAN", "partnerISO": "USA", "flowCode": "M", "cmdCode": "2709", "netWgt": 2_000_000_000},
                # Mirror for the same January flow must not be double counted.
                {"period": 202601, "reporterISO": "USA", "partnerISO": "CAN", "flowCode": "X", "cmdCode": "2709", "netWgt": 9_000_000_000},
                {"period": 202601, "reporterISO": "JPN", "partnerISO": "USA", "flowCode": "M", "cmdCode": "271111", "netWgt": 1_000_000_000},
            ],
        )

        flows = RefreshableOilDataLoader(
            source_dir=self.source_dir,
            fallback_loader=FixtureLoader(),
        ).load_flows()
        oil = next(row for row in flows if row["commodity"] == "oil")
        gas = next(row for row in flows if row["commodity"] == "gas")

        self.assertEqual((oil["source_iso"], oil["target_iso"]), ("USA", "CAN"))
        self.assertEqual(oil["volume_mt"], 18.0)
        self.assertEqual(oil["period"], "2026-01/2026-02")
        self.assertEqual(oil["data_type"], "annualized_ytd")
        self.assertTrue(oil["is_partial"])
        self.assertEqual(oil["reporting_basis"], "importer_reported")

        self.assertEqual((gas["source_iso"], gas["target_iso"]), ("USA", "JPN"))
        self.assertAlmostEqual(gas["volume_bcm"], 16.3105056, places=9)
        self.assertIn("EIA 48 Bcf/Mt", gas["conversion_method"])
        self.assertEqual(gas["confidence"], "medium")

    def test_eurostat_precedes_duplicate_comtrade_month_and_uses_reporter_coverage(self) -> None:
        self._write_json(
            "comtrade",
            [{
                "period": 202601,
                "reporterISO": "DEU",
                "partnerISO": "USA",
                "flowCode": "M",
                "cmdCode": "2709",
                "netWgt": 9_000_000_000,
                "source": "UN Comtrade monthly HS 2709",
            }],
        )
        self._write_json(
            "eurostat_comext",
            [
                {
                    "period": "2026-01",
                    "reporterISO": "DEU",
                    "partnerISO": "USA",
                    "flowCode": "M",
                    "cmdCode": "2709",
                    "netWgt": 2_000_000_000,
                    "source": "Eurostat Comext DS-045409",
                },
                {
                    "period": "2026-04",
                    "reporterISO": "DEU",
                    "partnerISO": "SAU",
                    "flowCode": "M",
                    "cmdCode": "2709",
                    "netWgt": 1_000_000_000,
                    "source": "Eurostat Comext DS-045409",
                },
            ],
        )

        flows = RefreshableOilDataLoader(
            source_dir=self.source_dir,
            fallback_loader=FixtureLoader(),
        ).load_flows()
        usa_to_germany = next(
            row for row in flows
            if row["source_iso"] == "USA" and row["target_iso"] == "DEU"
        )

        # Germany reports through April, so its 2 Mt January observation is
        # annualized by 12/4. The duplicate 9 Mt Comtrade row is discarded.
        self.assertEqual(usa_to_germany["volume_mt"], 6.0)
        self.assertEqual(usa_to_germany["period"], "2026-01/2026-04")
        self.assertEqual(usa_to_germany["source"], "Eurostat Comext DS-045409")

    def test_raw_jodi_months_are_annualized_and_marked_partial(self) -> None:
        self._write_json(
            "jodi",
            [
                {"REF_AREA": "US", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "CRUDEOIL", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "KTONS", "OBS_VALUE": "50000", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "US", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "CRUDEOIL", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "KTONS", "OBS_VALUE": "51000", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "US", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "CRUDEOIL", "FLOW_BREAKDOWN": "TOTIMPSB", "UNIT_MEASURE": "KTONS", "OBS_VALUE": "10000", "ASSESSMENT_CODE": "2"},
                {"REF_AREA": "US", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "CRUDEOIL", "FLOW_BREAKDOWN": "TOTIMPSB", "UNIT_MEASURE": "KTONS", "OBS_VALUE": "12000", "ASSESSMENT_CODE": "2"},
                {"REF_AREA": "US", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "CRUDEOIL", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "KBD", "OBS_VALUE": "999", "ASSESSMENT_CODE": "1"}
            ]
        )

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        usa = {row["iso"]: row for row in loader.load_countries()}["USA"]

        self.assertEqual(usa["name"], "United States")
        self.assertEqual(usa["production_oil_mt"], 606.0)
        self.assertEqual(usa["import_oil_mt"], 132.0)
        self.assertEqual(usa["oil_period"], "2026-01/2026-02")
        self.assertEqual(usa["oil_data_type"], "annualized_ytd")
        self.assertTrue(usa["oil_is_partial"])
        self.assertEqual(usa["oil_confidence"], "medium")
        self.assertEqual(usa["confidence"], "medium")

    def test_raw_jodi_gas_uses_latest_year_and_observed_demand(self) -> None:
        self._write_json(
            "jodi_gas",
            [
                {"REF_AREA": "CA", "TIME_PERIOD": "2025-12", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "M3", "OBS_VALUE": "999999", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "M3", "OBS_VALUE": "20000", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "INDPROD", "UNIT_MEASURE": "M3", "OBS_VALUE": "22000", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "TOTDEMO", "UNIT_MEASURE": "M3", "OBS_VALUE": "10000", "ASSESSMENT_CODE": "2"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "TOTDEMC", "UNIT_MEASURE": "M3", "OBS_VALUE": "99999", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "TOTDEMC", "UNIT_MEASURE": "M3", "OBS_VALUE": "12000", "ASSESSMENT_CODE": "2"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-01", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "TOTIMPSB", "UNIT_MEASURE": "M3", "OBS_VALUE": "1000", "ASSESSMENT_CODE": "1"},
                {"REF_AREA": "CA", "TIME_PERIOD": "2026-02", "ENERGY_PRODUCT": "NATGAS", "FLOW_BREAKDOWN": "TOTEXPSB", "UNIT_MEASURE": "M3", "OBS_VALUE": "8000", "ASSESSMENT_CODE": "1"}
            ]
        )

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        canada = {row["iso"]: row for row in loader.load_countries()}["CAN"]

        self.assertEqual(canada["production_gas_bcm"], 252.0)
        self.assertEqual(canada["consumption_gas_bcm"], 132.0)
        self.assertEqual(canada["import_gas_bcm"], 12.0)
        self.assertEqual(canada["export_gas_bcm"], 96.0)
        self.assertEqual(canada["gas_period"], "2026-01/2026-02")
        self.assertEqual(canada["gas_data_type"], "annualized_ytd")
        self.assertTrue(canada["gas_is_partial"])
        self.assertEqual(canada["gas_confidence"], "medium")

    def test_eia_international_2025_baseline_converts_tbpd_to_mt(self) -> None:
        self._write_json(
            "eia_international",
            [
                {"period": "2025", "productId": "53", "activityId": "1", "countryRegionId": "CAN", "countryRegionName": "Canada", "unit": "TBPD", "value": "1000"},
                {"period": "2025", "productId": "53", "activityId": "2", "countryRegionId": "CAN", "countryRegionName": "Canada", "unit": "TBPD", "value": "800"},
                {"period": "2025", "productId": "53", "activityId": "3", "countryRegionId": "CAN", "countryRegionName": "Canada", "unit": "TBPD", "value": "200"},
                {"period": "2025", "productId": "57", "activityId": "1", "countryRegionId": "CAN", "countryRegionName": "Canada", "unit": "TBPD", "value": "9999"},
                {"period": "2024", "productId": "53", "activityId": "1", "countryRegionId": "CAN", "countryRegionName": "Canada", "unit": "TBPD", "value": "9999"}
            ]
        )

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        canada = {row["iso"]: row for row in loader.load_countries()}["CAN"]

        self.assertEqual(canada["production_oil_mt"], 49.795)
        self.assertEqual(canada["consumption_oil_mt"], 39.836)
        self.assertEqual(canada["import_oil_mt"], 9.959)
        self.assertEqual(canada["export_oil_mt"], 200.0)
        self.assertEqual(canada["oil_period"], "2025 (mixed trade baseline)")
        self.assertEqual(canada["oil_data_type"], "mixed")
        self.assertTrue(canada["oil_is_partial"])

    def test_eia_bulk_zip_is_filtered_to_required_series(self) -> None:
        payload = io.BytesIO()
        series = [
            {"series_id": "INTL.53-1-CAN-TBPD.A", "data": [["2025", 1000], ["2024", 900]]},
            {"series_id": "INTL.53-2-CAN-TBPD.A", "data": [["2025", 800]]},
            {"series_id": "INTL.66-2-CAN-TBPD.A", "data": [["2025", 99999]]},
        ]
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("INTL.txt", "\n".join(json.dumps(row, separators=(",", ":")) for row in series))

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        rows = loader._read_bytes(payload.getvalue(), "INTL.zip", "application/zip")

        self.assertEqual(len(rows), 3)
        self.assertEqual({row["activityId"] for row in rows}, {"1", "2"})
        self.assertTrue(all(row["productId"] == "53" for row in rows))

    def test_eia_dry_gas_baseline_uses_latest_complete_annual_bcm(self) -> None:
        self._write_json(
            "eia_international",
            [
                {"period": "2024", "productId": "26", "activityId": "1", "countryRegionId": "CAN", "unit": "BCM", "value": "194.2"},
                {"period": "2024", "productId": "26", "activityId": "2", "countryRegionId": "CAN", "unit": "BCM", "value": "126.7"},
                {"period": "2024", "productId": "26", "activityId": "3", "countryRegionId": "CAN", "unit": "BCM", "value": "24.1"},
                {"period": "2024", "productId": "26", "activityId": "4", "countryRegionId": "CAN", "unit": "BCM", "value": "91.6"},
                {"period": "2023", "productId": "26", "activityId": "1", "countryRegionId": "CAN", "unit": "BCM", "value": "999"},
            ],
        )

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        canada = {row["iso"]: row for row in loader.load_countries()}["CAN"]

        self.assertEqual(canada["production_gas_bcm"], 194.2)
        self.assertEqual(canada["consumption_gas_bcm"], 126.7)
        self.assertEqual(canada["import_gas_bcm"], 24.1)
        self.assertEqual(canada["export_gas_bcm"], 91.6)
        self.assertEqual(canada["gas_period"], "2024")
        self.assertEqual(canada["gas_data_type"], "annual")
        self.assertFalse(canada["gas_is_partial"])

    def test_eia_bulk_zip_keeps_dry_gas_series(self) -> None:
        payload = io.BytesIO()
        series = [
            {"series_id": "INTL.26-1-CAN-BCM.A", "data": [["2024", 194.2]]},
            {"series_id": "INTL.26-4-CAN-BCM.A", "data": [["2024", 91.6]]},
            {"series_id": "INTL.26-1-CAN-BCF.A", "data": [["2024", 99999]]},
        ]
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("INTL.txt", "\n".join(json.dumps(row, separators=(",", ":")) for row in series))

        loader = RefreshableOilDataLoader(source_dir=self.source_dir, fallback_loader=FixtureLoader())
        rows = loader._read_bytes(payload.getvalue(), "INTL.zip", "application/zip")

        self.assertEqual(len(rows), 2)
        self.assertEqual({row["activityId"] for row in rows}, {"1", "4"})
        self.assertTrue(all(row["productId"] == "26" and row["unit"] == "BCM" for row in rows))


if __name__ == "__main__":
    unittest.main()
