import json
import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
