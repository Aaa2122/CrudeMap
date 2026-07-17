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
    production_oil_mt: float
    import_oil_mt: float
    export_oil_mt: float
    consumption_oil_mt: float
    refining_capacity_mt: float
    production_gas_bcm: float = 0.0
    import_gas_bcm: float = 0.0
    export_gas_bcm: float = 0.0
    consumption_gas_bcm: float = 0.0
    dependency_score_gas: float = 0.0
    data_level: str = "A"

    model_config = {"from_attributes": True}


class CountryDetail(CountryBrief):
    source: str | None
    source_year: int | None
    confidence: str | None
    oil_source: str | None = None
    oil_confidence: str | None = None
    oil_period: str | None = None
    oil_data_type: str = "annual"
    oil_is_partial: bool = False
    gas_source: str | None = None
    gas_confidence: str | None = None
    gas_period: str | None = None
    gas_data_type: str = "annual"
    gas_is_partial: bool = False
