from sqlalchemy import Column, Integer, String, Float, JSON
from app.database import Base


class Infrastructure(Base):
    __tablename__ = "infrastructures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    type = Column(String)       # port / terminal / pipeline / refinery / lng_terminal
    subtype = Column(String)    # export_terminal / import_terminal / crude_pipeline / etc.
    country_iso = Column(String(3))
    operator = Column(String)
    commodity = Column(String, default="oil")  # oil / gas / products
    capacity_mt = Column(Float, default=0.0)   # Mt/yr (oil)
    capacity_bcm = Column(Float, nullable=True)  # bcm/yr (gas)
    status = Column(String, default="active")  # active / limited / offline
    criticality_score = Column(Float, default=0.0)

    lat = Column(Float)
    lon = Column(Float)
    # GeoJSON LineString coordinates for pipelines ({"type": "LineString", "coordinates": [...]})
    geometry = Column(JSON, nullable=True)

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
    confidence = Column(String, default="medium")
