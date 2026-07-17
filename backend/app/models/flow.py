from sqlalchemy import ARRAY, Boolean, Column, Float, Integer, String
from app.database import Base


class CountryFlow(Base):
    __tablename__ = "country_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_iso = Column(String(3), nullable=False)
    target_iso = Column(String(3), nullable=False)
    commodity = Column(String, default="oil", index=True)  # oil / gas
    transport_mode = Column(String, default="seaborne")    # seaborne / pipeline / unspecified
    volume_mt = Column(Float, default=0.0)          # Mt/yr (oil)
    volume_bcm = Column(Float, nullable=True)       # bcm/yr (gas only)
    # Chokepoint slugs this flow passes through — key for simulation
    via_chokepoints = Column(ARRAY(String), default=list)
    year = Column(Integer, default=2024)
    period = Column(String, nullable=True)             # e.g. 2026-01/2026-04
    data_type = Column(String, default="annual")      # annual / monthly / annualized_ytd
    is_partial = Column(Boolean, default=False)
    reporting_basis = Column(String, nullable=True)    # importer_reported / exporter_reported
    conversion_method = Column(String, nullable=True)

    # Provenance
    source = Column(String, default="seed")
    source_url = Column(String, nullable=True)
    confidence = Column(String, default="medium")
