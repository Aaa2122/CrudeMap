from pydantic import BaseModel


class CountryBrief(BaseModel):
    iso: str
    name: str
    region: str | None
    role: str | None
    lat: float | None
    lon: float | None
    importance_score: float
    resilience_score: float
    dependency_score: float
    supplier_hhi: float
    data_level: str = "A"

    model_config = {"from_attributes": True}


class CountryDetail(CountryBrief):
    production_oil_mt: float
    import_oil_mt: float
    export_oil_mt: float
    consumption_oil_mt: float
    refining_capacity_mt: float
    source: str | None
    source_year: int | None
    confidence: str | None
