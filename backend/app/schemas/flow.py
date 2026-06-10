from pydantic import BaseModel


class FlowOut(BaseModel):
    id: int
    source_iso: str
    target_iso: str
    commodity: str = "oil"
    transport_mode: str = "seaborne"
    volume_mt: float
    volume_bcm: float | None = None
    via_chokepoints: list[str]
    year: int
    source: str | None
    confidence: str | None

    model_config = {"from_attributes": True}
