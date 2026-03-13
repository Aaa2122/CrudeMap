from pydantic import BaseModel


class ChokepointBrief(BaseModel):
    slug: str
    name: str
    lat: float | None
    lon: float | None
    oil_transit_mbd: float
    pct_world_trade: float
    risk_level: str

    model_config = {"from_attributes": True}


class ExposedCountry(BaseModel):
    iso: str
    name: str
    exposure: float   # share of imports via this chokepoint (0-1)
    import_volume_mt: float


class ChokepointDetail(ChokepointBrief):
    source: str | None
    source_year: int | None
    exposed_countries: list[ExposedCountry] = []
