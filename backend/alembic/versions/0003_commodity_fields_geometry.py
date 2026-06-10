"""add commodity dimension, gas columns, pipeline geometry and fields table

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # countries: natural gas profile (bcm/yr) + gas dependency score
    op.add_column("countries", sa.Column("production_gas_bcm", sa.Float(), server_default="0"))
    op.add_column("countries", sa.Column("import_gas_bcm", sa.Float(), server_default="0"))
    op.add_column("countries", sa.Column("export_gas_bcm", sa.Float(), server_default="0"))
    op.add_column("countries", sa.Column("consumption_gas_bcm", sa.Float(), server_default="0"))
    op.add_column("countries", sa.Column("dependency_score_gas", sa.Float(), server_default="0"))

    # country_flows: commodity dimension
    op.add_column("country_flows", sa.Column("commodity", sa.String(), server_default="oil"))
    op.add_column("country_flows", sa.Column("transport_mode", sa.String(), server_default="seaborne"))
    op.add_column("country_flows", sa.Column("volume_bcm", sa.Float(), nullable=True))
    op.create_index("ix_country_flows_commodity", "country_flows", ["commodity"])

    # infrastructures: commodity, gas capacity, pipeline route geometry
    op.add_column("infrastructures", sa.Column("commodity", sa.String(), server_default="oil"))
    op.add_column("infrastructures", sa.Column("capacity_bcm", sa.Float(), nullable=True))
    op.add_column("infrastructures", sa.Column("geometry", postgresql.JSON(), nullable=True))

    op.create_table(
        "fields",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("country_iso", sa.String(3)),
        sa.Column("commodity", sa.String(), server_default="oil"),  # oil / gas / mixed
        sa.Column("field_type", sa.String()),  # conventional / shale / offshore / oil_sands / condensate
        sa.Column("production_mt", sa.Float(), nullable=True),
        sa.Column("production_bcm", sa.Float(), nullable=True),
        sa.Column("discovered_year", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), server_default="producing"),  # producing / declining / developing
        sa.Column("operator", sa.String()),
        sa.Column("lat", sa.Float()),
        sa.Column("lon", sa.Float()),
        sa.Column("source", sa.String(), server_default="seed"),
        sa.Column("source_year", sa.Integer(), server_default="2024"),
        sa.Column("confidence", sa.String(), server_default="medium"),
    )


def downgrade():
    op.drop_table("fields")
    op.drop_column("infrastructures", "geometry")
    op.drop_column("infrastructures", "capacity_bcm")
    op.drop_column("infrastructures", "commodity")
    op.drop_index("ix_country_flows_commodity", "country_flows")
    op.drop_column("country_flows", "volume_bcm")
    op.drop_column("country_flows", "transport_mode")
    op.drop_column("country_flows", "commodity")
    op.drop_column("countries", "dependency_score_gas")
    op.drop_column("countries", "consumption_gas_bcm")
    op.drop_column("countries", "export_gas_bcm")
    op.drop_column("countries", "import_gas_bcm")
    op.drop_column("countries", "production_gas_bcm")
