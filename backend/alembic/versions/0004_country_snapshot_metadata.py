"""Add commodity-specific country snapshot metadata.

Revision ID: 0004
Revises: 0003
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("countries", sa.Column("oil_source", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("oil_confidence", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("oil_period", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("oil_data_type", sa.String(), nullable=False, server_default="annual"))
    op.add_column("countries", sa.Column("oil_is_partial", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("countries", sa.Column("gas_source", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("gas_confidence", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("gas_period", sa.String(), nullable=True))
    op.add_column("countries", sa.Column("gas_data_type", sa.String(), nullable=False, server_default="annual"))
    op.add_column("countries", sa.Column("gas_is_partial", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    for column in (
        "gas_is_partial",
        "gas_data_type",
        "gas_period",
        "gas_source",
        "gas_confidence",
        "oil_is_partial",
        "oil_data_type",
        "oil_period",
        "oil_source",
        "oil_confidence",
    ):
        op.drop_column("countries", column)
