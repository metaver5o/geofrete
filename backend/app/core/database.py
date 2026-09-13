from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database extensions and schema tables."""
    with engine.begin() as connection:
        # Enable PostGIS extension if available on PostgreSQL
        if "postgresql" in settings.DATABASE_URL:
            try:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            except Exception as e:
                # Log or tolerate if already enabled or running in mock/sqlite for tests
                pass
        Base.metadata.create_all(bind=connection)
