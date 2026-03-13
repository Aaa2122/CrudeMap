"""add data_level column to countries

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "countries",
        sa.Column("data_level", sa.String(), server_default="A"),
    )


def downgrade():
    op.drop_column("countries", "data_level")
