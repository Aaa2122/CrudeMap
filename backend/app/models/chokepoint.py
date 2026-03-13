from sqlalchemy import Column, String, Float, Integer
from app.database import Base


class Chokepoint(Base):
    __tablename__ = "chokepoints"

    slug = Column(String, primary_key=True)   # e.g. "hormuz"
    name = Column(String, nullable=False)
    lat = Column(Float)
    lon = Column(Float)

    # Traffic
    oil_transit_mbd = Column(Float, default=0.0)   # million barrels/day
    pct_world_trade = Column(Float, default=0.0)   # 0-100

    risk_level = Column(String, default="medium")  # low / medium / high / critical

    # Provenance
    source = Column(String, default="seed")
    source_year = Column(Integer, default=2024)
