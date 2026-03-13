from sqlalchemy import Column, String, Float, Integer
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

    # Computed scores (written at seed time by scoring engine)
    importance_score = Column(Float, default=0.0)
    resilience_score = Column(Float, default=0.0)
    dependency_score = Column(Float, default=0.0)   # import / consumption
    supplier_hhi = Column(Float, default=0.0)

    # Data coverage level: "B" = detailed (infra), "A" = macro only
    data_level = Column(String, default="A")

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
    confidence = Column(String, default="medium")
