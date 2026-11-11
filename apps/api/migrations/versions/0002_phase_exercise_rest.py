"""add phase_exercise.rest_seconds (inter-exercise rest) -- T-rest.

A single-pass phase (rounds=1) now gives the user a rest *between each exercise* via a per-item
``rest_seconds`` (0 == continuous). This is additive: a new column on ``phase_exercise`` with a
server_default of 0, so existing rows/seed stay valid. Mirrors the model
``PhaseExercise.rest_seconds`` and the contract field ``restSeconds`` (D1/D6).

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "phase_exercise",
        sa.Column("rest_seconds", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("phase_exercise", "rest_seconds")
