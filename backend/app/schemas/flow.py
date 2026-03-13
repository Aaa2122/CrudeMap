from pydantic import BaseModel


class FlowOut(BaseModel):
    id: int
    source_iso: str
    target_iso: str
    volume_mt: float
    via_chokepoints: list[str]
    year: int
    source: str | None
    confidence: str | None

    model_config = {"from_attributes": True}
