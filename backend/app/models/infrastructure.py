from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class Infrastructure(Base):
    __tablename__ = "infrastructures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    type = Column(String)       # port / terminal / pipeline / refinery
    subtype = Column(String)    # export_terminal / import_terminal / crude_pipeline / etc.
    country_iso = Column(String(3))
    operator = Column(String)
    capacity_mt = Column(Float, default=0.0)   # Mt/yr
    status = Column(String, default="active")  # active / limited / offline
    criticality_score = Column(Float, default=0.0)

    lat = Column(Float)
    lon = Column(Float)

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
    confidence = Column(String, default="medium")
