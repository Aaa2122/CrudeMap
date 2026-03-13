from sqlalchemy import Column, String, JSON
from app.database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    slug = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String)
    scenario_type = Column(String)  # chokepoint / country / infrastructure

    # List of disruption rules: [{target_type, target_id, param, delta}]
    # param: "capacity_factor" (0-1 multiplier) or "cost_multiplier"
    disruptions = Column(JSON, default=list)
