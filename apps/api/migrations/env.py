"""Alembic environment for coach.ai (T-10).

Wires the model metadata (app.db.models.Base) into Alembic so autogeneration (future migrations,
e.g. T-11) compares against it. The live connection URL comes from DATABASE_URL; the alembic.ini
url is only a placeholder so `alembic` can start. No real connection string is committed.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app.db import models


def _url() -> str:
    """DATABASE_URL wins over the alembic.ini placeholder; normalise postgres:// -> postgresql://."""
    raw = os.environ.get("DATABASE_URL") or context.config.get_main_option("sqlalchemy.url")
    if not raw:
        raise SystemExit("set DATABASE_URL (or the alembic.ini sqlalchemy.url) to run migrations")
    if raw.startswith("postgres://"):
        return "postgresql://" + raw.split("://", 1)[1]
    return raw


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=models.Base.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=False,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=models.Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
