from sqlalchemy import Column, Integer, String, Float, ARRAY
from app.database import Base


class CountryFlow(Base):
    __tablename__ = "country_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_iso = Column(String(3), nullable=False)
    target_iso = Column(String(3), nullable=False)
    commodity = Column(String, default="oil", index=True)  # oil / gas
    transport_mode = Column(String, default="seaborne")    # seaborne / pipeline
    volume_mt = Column(Float, default=0.0)          # Mt/yr (oil)
    volume_bcm = Column(Float, nullable=True)       # bcm/yr (gas only)
    # Chokepoint slugs this flow passes through — key for simulation
    via_chokepoints = Column(ARRAY(String), default=list)
    year = Column(Integer, default=2024)

    # Provenance
    source = Column(String, default="seed")
    confidence = Column(String, default="medium")
