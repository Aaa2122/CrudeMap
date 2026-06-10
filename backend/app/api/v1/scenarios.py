from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.country_repo import CountryRepository
from app.repositories.flow_repo import FlowRepository
from app.repositories.scenario_repo import ScenarioRepository
from app.schemas.scenario import ScenarioBrief, ScenarioRunResult, ScenarioImpact
from simulation.engine import run_scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioBrief])
async def list_scenarios(session: AsyncSession = Depends(get_session)):
    repo = ScenarioRepository(session)
    return await repo.list_all()


@router.post("/{slug}/run", response_model=ScenarioRunResult)
async def run_scenario_endpoint(slug: str, session: AsyncSession = Depends(get_session)):
    scenario_repo = ScenarioRepository(session)
    country_repo = CountryRepository(session)
    flow_repo = FlowRepository(session)

    scenario = await scenario_repo.get_by_slug(slug)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{slug}' not found")

    countries = await country_repo.list_all()
    # Simulation operates on the oil network only — gas flows must not enter the graph
    flows = await flow_repo.list_by_commodity("oil")

    flows_list = [
        {
            "id": f.id,
            "source_iso": f.source_iso,
            "target_iso": f.target_iso,
            "volume_mt": f.volume_mt,
            "via_chokepoints": f.via_chokepoints or [],
        }
        for f in flows
    ]
    countries_list = [
        {
            "iso": c.iso,
            "import_oil_mt": c.import_oil_mt or 0,
            "consumption_oil_mt": c.consumption_oil_mt or 0,
        }
        for c in countries
    ]

    impacts = run_scenario(flows_list, countries_list, scenario.disruptions or [])

    # Identify disrupted flow IDs for frontend map coloring
    disrupted_ids = _get_disrupted_flow_ids(flows_list, scenario.disruptions or [])

    return ScenarioRunResult(
        slug=scenario.slug,
        name=scenario.name,
        impacts=[ScenarioImpact(**i) for i in impacts],
        disrupted_flow_ids=disrupted_ids,
    )


def _get_disrupted_flow_ids(flows: list[dict], disruptions: list[dict]) -> list[int]:
    disrupted = []
    for flow in flows:
        for d in disruptions:
            if d["target_type"] == "chokepoint" and d["target_id"] in flow["via_chokepoints"]:
                disrupted.append(flow["id"])
                break
            elif d["target_type"] == "country" and d["target_id"] == flow["source_iso"]:
                disrupted.append(flow["id"])
                break
    return disrupted
