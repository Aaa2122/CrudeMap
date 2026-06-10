from pydantic import BaseModel


class InfrastructureOut(BaseModel):
    id: int
    name: str
    type: str | None
    subtype: str | None
    country_iso: str | None
    operator: str | None
    commodity: str = "oil"
    capacity_mt: float
    capacity_bcm: float | None = None
    status: str
    criticality_score: float
    lat: float | None
    lon: float | None
    geometry: dict | None = None
    source: str | None
    confidence: str | None

    model_config = {"from_attributes": True}
