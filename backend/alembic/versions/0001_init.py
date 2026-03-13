"""init

Revision ID: 0001
Revises:
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "countries",
        sa.Column("iso", sa.String(3), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("region", sa.String()),
        sa.Column("role", sa.String()),
        sa.Column("lat", sa.Float()),
        sa.Column("lon", sa.Float()),
        sa.Column("production_oil_mt", sa.Float(), default=0.0),
        sa.Column("import_oil_mt", sa.Float(), default=0.0),
        sa.Column("export_oil_mt", sa.Float(), default=0.0),
        sa.Column("consumption_oil_mt", sa.Float(), default=0.0),
        sa.Column("refining_capacity_mt", sa.Float(), default=0.0),
        sa.Column("importance_score", sa.Float(), default=0.0),
        sa.Column("resilience_score", sa.Float(), default=0.0),
        sa.Column("dependency_score", sa.Float(), default=0.0),
        sa.Column("supplier_hhi", sa.Float(), default=0.0),
        sa.Column("source", sa.String(), default="seed"),
        sa.Column("source_year", sa.Integer(), default=2024),
        sa.Column("confidence", sa.String(), default="medium"),
    )

    op.create_table(
        "chokepoints",
        sa.Column("slug", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("lat", sa.Float()),
        sa.Column("lon", sa.Float()),
        sa.Column("oil_transit_mbd", sa.Float(), default=0.0),
        sa.Column("pct_world_trade", sa.Float(), default=0.0),
        sa.Column("risk_level", sa.String(), default="medium"),
        sa.Column("source", sa.String(), default="seed"),
        sa.Column("source_year", sa.Integer(), default=2024),
    )

    op.create_table(
        "infrastructures",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String()),
        sa.Column("subtype", sa.String()),
        sa.Column("country_iso", sa.String(3)),
        sa.Column("operator", sa.String()),
        sa.Column("capacity_mt", sa.Float(), default=0.0),
        sa.Column("status", sa.String(), default="active"),
        sa.Column("criticality_score", sa.Float(), default=0.0),
        sa.Column("lat", sa.Float()),
        sa.Column("lon", sa.Float()),
        sa.Column("source", sa.String(), default="seed"),
        sa.Column("source_year", sa.Integer(), default=2024),
        sa.Column("confidence", sa.String(), default="medium"),
    )

    op.create_table(
        "country_flows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_iso", sa.String(3), nullable=False),
        sa.Column("target_iso", sa.String(3), nullable=False),
        sa.Column("volume_mt", sa.Float(), default=0.0),
        sa.Column("via_chokepoints", postgresql.ARRAY(sa.String()), default=list),
        sa.Column("year", sa.Integer(), default=2024),
        sa.Column("source", sa.String(), default="seed"),
        sa.Column("confidence", sa.String(), default="medium"),
    )

    op.create_table(
        "scenarios",
        sa.Column("slug", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String()),
        sa.Column("scenario_type", sa.String()),
        sa.Column("disruptions", postgresql.JSON(), default=list),
    )


def downgrade():
    op.drop_table("scenarios")
    op.drop_table("country_flows")
    op.drop_table("infrastructures")
    op.drop_table("chokepoints")
    op.drop_table("countries")
