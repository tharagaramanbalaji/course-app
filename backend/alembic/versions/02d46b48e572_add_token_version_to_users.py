"""Add token_version to users.

Bumped on logout, which invalidates every refresh token issued before it.
Existing rows default to 1.


Revision ID: 02d46b48e572
Revises: 74af19bc71c5
Create Date: 2026-08-26 13:48:50.354022

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '02d46b48e572'
down_revision: str | None = '74af19bc71c5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'token_version')
