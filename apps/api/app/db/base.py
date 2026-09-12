"""SQLAlchemy declarative base + the shared ``Base.metadata`` for the coach.ai schema.

This is the **single source of truth** for the database: the Alembic ``0001_initial`` migration
materializes exactly ``Base.metadata``, so the models and the migration cannot drift. See
``docs/HIIT_WORKOUT_APP_DESIGN.md`` section 4 for the DDL this encodes.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()
