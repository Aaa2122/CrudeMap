"""Master seed script.

Usage (from backend/):
    python -m etl.seed

Idempotent: truncates all tables then reloads from the DataLoader.
After loading raw data it runs the scoring engine to compute scores.
"""
import os
import sys

# Allow running from backend/ root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.country import Country
from app.models.chokepoint import Chokepoint
from app.models.infrastructure import Infrastructure
from app.models.flow import CountryFlow
from app.models.scenario import Scenario
from etl.loaders.json_loader import JsonLoader
from etl.loaders.refresh_loader import RefreshableOilDataLoader
from scoring.engine import compute_and_write_scores


def build_loader():
    loader_name = os.getenv("ETL_LOADER", "json").strip().lower()
    if loader_name in {"json", "static"}:
        return JsonLoader()
    if loader_name in {"refresh", "refreshable"}:
        return RefreshableOilDataLoader()
    raise ValueError(f"Unsupported ETL_LOADER: {loader_name}")


def seed(loader=None):
    if loader is None:
        loader = build_loader()

    engine = create_engine(settings.sync_database_url, echo=False)

    with Session(engine) as session:
        print("Truncating tables...")
        session.execute(text("TRUNCATE country_flows, scenarios, infrastructures, chokepoints, countries RESTART IDENTITY CASCADE"))
        session.commit()

        print("Loading chokepoints...")
        for row in loader.load_chokepoints():
            session.add(Chokepoint(**row))
        session.commit()

        print("Loading countries...")
        for row in loader.load_countries():
            session.add(Country(**row))
        session.commit()

        print("Loading infrastructures...")
        for row in loader.load_infrastructures():
            session.add(Infrastructure(**row))
        session.commit()

        print("Loading flows...")
        for row in loader.load_flows():
            # skip flows whose country ISOs aren't in DB
            session.add(CountryFlow(**{k: v for k, v in row.items() if k != "year"}, year=row.get("year", 2024)))
        session.commit()

        print("Loading scenarios...")
        for row in loader.load_scenarios():
            session.add(Scenario(**row))
        session.commit()

    print(f"Running scoring engine with {loader.describe()}...")
    compute_and_write_scores(engine)

    print("✓ Seed complete.")


if __name__ == "__main__":
    seed()
