from pydantic import BaseModel


class FieldOut(BaseModel):
    id: int
    name: str
    country_iso: str | None
    commodity: str = "oil"
    field_type: str | None
    production_mt: float | None = None
    production_bcm: float | None = None
    discovered_year: int | None = None
    status: str
    operator: str | None
    lat: float | None
    lon: float | None
    source: str | None
    confidence: str | None

    model_config = {"from_attributes": True}
