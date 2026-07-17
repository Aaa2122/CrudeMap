"""Add flow snapshot provenance and freshness metadata.

Revision ID: 0005
Revises: 0004
"""

from alembic import op
import sqlalchemy as sa


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("country_flows", sa.Column("period", sa.String(), nullable=True))
    op.add_column("country_flows", sa.Column("data_type", sa.String(), nullable=False, server_default="annual"))
    op.add_column("country_flows", sa.Column("is_partial", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("country_flows", sa.Column("reporting_basis", sa.String(), nullable=True))
    op.add_column("country_flows", sa.Column("conversion_method", sa.String(), nullable=True))
    op.add_column("country_flows", sa.Column("source_url", sa.String(), nullable=True))


def downgrade() -> None:
    for column in ("source_url", "conversion_method", "reporting_basis", "is_partial", "data_type", "period"):
        op.drop_column("country_flows", column)
