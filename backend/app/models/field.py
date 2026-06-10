from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class OilGasField(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    country_iso = Column(String(3))
    commodity = Column(String, default="oil")  # oil / gas / mixed
    field_type = Column(String)  # conventional / shale / offshore / oil_sands / condensate
    production_mt = Column(Float, nullable=True)   # Mt/yr (oil)
    production_bcm = Column(Float, nullable=True)  # bcm/yr (gas)
    discovered_year = Column(Integer, nullable=True)
    status = Column(String, default="producing")  # producing / declining / developing
    operator = Column(String)

    lat = Column(Float)
    lon = Column(Float)

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
    confidence = Column(String, default="medium")
