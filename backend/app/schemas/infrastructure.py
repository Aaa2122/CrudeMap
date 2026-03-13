from pydantic import BaseModel


class InfrastructureOut(BaseModel):
    id: int
    name: str
    type: str | None
    subtype: str | None
    country_iso: str | None
    operator: str | None
    capacity_mt: float
    status: str
    criticality_score: float
    lat: float | None
    lon: float | None
    source: str | None
    confidence: str | None

    model_config = {"from_attributes": True}
