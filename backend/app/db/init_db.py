from sqlalchemy import text, inspect

from app.db.database import Base, engine
# Import models so metadata is registered before creating tables
import app.models.models  # noqa: F401


def init_db() -> None:
    """Create all tables from scratch. Safe for fresh databases."""
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def _run_migrations() -> None:
    """Run lightweight column migrations for existing tables."""
    inspector = inspect(engine)
    
    # Check if users table exists
    if 'users' not in inspector.get_table_names():
        return
    
    existing_columns = {col['name'] for col in inspector.get_columns('users')}
    
    with engine.begin() as conn:
        # Add google_id column if missing
        if 'google_id' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE"
            ))
        
        # Add google_email column if missing
        if 'google_email' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN google_email VARCHAR(255)"
            ))


if __name__ == "__main__":
    init_db()
