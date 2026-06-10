"""Default DataLoader: reads from static JSON files in etl/data/.

To add a new data source (e.g. IEA API), implement DataLoader in a new file
alongside this one. The seed runner will use whichever loader is injected.
"""
import json
from pathlib import Path

from etl.loaders.base import DataLoader

DATA_DIR = Path(__file__).parent.parent / "data"


class JsonLoader(DataLoader):
    def _load(self, filename: str) -> list[dict]:
        with open(DATA_DIR / filename, encoding="utf-8") as f:
            return json.load(f)

    def load_countries(self) -> list[dict]:
        return self._load("countries.json")

    def load_chokepoints(self) -> list[dict]:
        return self._load("chokepoints.json")

    def load_infrastructures(self) -> list[dict]:
        return (
            self._load("infrastructures.json")
            + self._load("pipelines.json")
            + self._load("lng_terminals.json")
        )

    def load_flows(self) -> list[dict]:
        return self._load("flows.json") + self._load("flows_gas.json")

    def load_fields(self) -> list[dict]:
        return self._load("fields.json")

    def load_scenarios(self) -> list[dict]:
        return self._load("scenarios.json")
