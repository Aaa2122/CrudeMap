from pydantic import BaseModel


class ScenarioBrief(BaseModel):
    slug: str
    name: str
    description: str | None
    scenario_type: str | None

    model_config = {"from_attributes": True}


class ScenarioImpact(BaseModel):
    country_iso: str
    stress_score: float
    volume_lost_mt: float
    cost_increase_pct: float
    can_reroute: bool
    baseline_import_mt: float


class ScenarioRunResult(BaseModel):
    slug: str
    name: str
    impacts: list[ScenarioImpact]
    # Which flows are disrupted (for map coloring)
    disrupted_flow_ids: list[int] = []
