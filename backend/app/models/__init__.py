"""SQLAlchemy models.

Import every model module here so that ``Base.metadata`` is fully populated
before Alembic autogenerate runs.
"""

from app.db.base import Base

__all__ = ["Base"]
