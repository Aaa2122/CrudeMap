from sqlalchemy import Boolean, Column, String, Float, Integer
from app.database import Base


class Country(Base):
    __tablename__ = "countries"

    iso = Column(String(3), primary_key=True)
    name = Column(String, nullable=False)
    region = Column(String)
    role = Column(String)          # exporter / importer / hub / transit / mixed
    lat = Column(Float)
    lon = Column(Float)

    # Oil profile (Mt/yr, 2024 estimates)
    production_oil_mt = Column(Float, default=0.0)
    import_oil_mt = Column(Float, default=0.0)
    export_oil_mt = Column(Float, default=0.0)
    consumption_oil_mt = Column(Float, default=0.0)
    refining_capacity_mt = Column(Float, default=0.0)

    # Natural gas profile (bcm/yr, 2024 estimates)
    production_gas_bcm = Column(Float, default=0.0)
    import_gas_bcm = Column(Float, default=0.0)
    export_gas_bcm = Column(Float, default=0.0)
    consumption_gas_bcm = Column(Float, default=0.0)

    # Computed scores (written at seed time by scoring engine)
    importance_score = Column(Float, default=0.0)
    resilience_score = Column(Float, default=0.0)
    dependency_score = Column(Float, default=0.0)   # oil: import / consumption
    dependency_score_gas = Column(Float, default=0.0)  # gas: import / consumption
    supplier_hhi = Column(Float, default=0.0)

    # Data coverage level: "B" = detailed (infra), "A" = macro only
    data_level = Column(String, default="A")

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
    confidence = Column(String, default="medium")

    # Commodity-specific snapshot metadata. Current-year monthly observations
    # can coexist with the last complete annual baseline without pretending
    # that every value in this denormalized row has the same vintage.
    oil_source = Column(String, nullable=True)
    oil_confidence = Column(String, nullable=True)
    oil_period = Column(String, nullable=True)  # e.g. 2026-01/2026-04
    oil_data_type = Column(String, default="annual")  # annual / ytd / annualized_ytd / estimate
    oil_is_partial = Column(Boolean, default=False)
    gas_source = Column(String, nullable=True)
    gas_confidence = Column(String, nullable=True)
    gas_period = Column(String, nullable=True)
    gas_data_type = Column(String, default="annual")
    gas_is_partial = Column(Boolean, default=False)
