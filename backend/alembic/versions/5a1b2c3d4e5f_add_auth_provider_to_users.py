"""add auth_provider to users

Revision ID: 5a1b2c3d4e5f
Revises: 386a3de0d706
Create Date: 2026-08-29 23:08:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '5a1b2c3d4e5f'
down_revision: str | None = '386a3de0d706'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

auth_provider_enum = sa.Enum('LOCAL', 'GOOGLE', 'MICROSOFT', 'OKTA', name='auth_provider')


def upgrade() -> None:
    # Handle PostgreSQL native enum creation safely or fallback
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        auth_provider_enum.create(bind, checkfirst=True)
    op.add_column(
        'users',
        sa.Column(
            'auth_provider',
            auth_provider_enum,
            nullable=False,
            server_default='LOCAL',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'auth_provider')
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        auth_provider_enum.drop(bind, checkfirst=True)
