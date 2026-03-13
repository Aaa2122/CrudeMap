"""Scoring engine: reads all data from DB, computes scores, writes back.

Called once at the end of the seed process.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from scoring.formulas import (
    dependency_score,
    importance_score,
    resilience_score,
    route_concentration,
    supplier_hhi,
)

CHOKEPOINT_SLUGS = [
    "hormuz", "malacca", "suez", "sumed",
    "bab_el_mandeb", "turkish_straits", "panama",
]


def compute_and_write_scores(engine):
    with Session(engine) as session:
        countries = session.execute(text("SELECT * FROM countries")).mappings().all()
        flows = session.execute(text("SELECT * FROM country_flows")).mappings().all()
        flows_list = [dict(f) for f in flows]

        for country in countries:
            iso = country["iso"]
            dep = dependency_score(
                country["import_oil_mt"] or 0,
                country["consumption_oil_mt"] or 0,
            )
            hhi = supplier_hhi(flows_list, iso)
            route_concs = [
                route_concentration(flows_list, iso, slug)
                for slug in CHOKEPOINT_SLUGS
            ]
            max_route = max(route_concs) if route_concs else 0.0
            res = resilience_score(dep, hhi, max_route)
            imp = importance_score(
                country["production_oil_mt"] or 0,
                country["export_oil_mt"] or 0,
                country["import_oil_mt"] or 0,
                is_hub=(country["role"] in ("hub", "transit")),
            )

            session.execute(
                text("""
                    UPDATE countries
                    SET dependency_score = :dep,
                        supplier_hhi = :hhi,
                        resilience_score = :res,
                        importance_score = :imp
                    WHERE iso = :iso
                """),
                {"dep": dep, "hhi": hhi, "res": res, "imp": imp, "iso": iso},
            )

        session.commit()
        print(f"  Scores computed for {len(countries)} countries.")
