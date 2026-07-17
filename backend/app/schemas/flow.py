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
    period: str | None = None
    data_type: str = "annual"
    is_partial: bool = False
    reporting_basis: str | None = None
    conversion_method: str | None = None
    source: str | None
    source_url: str | None = None
    confidence: str | None

    model_config = {"from_attributes": True}
