import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Attempt to connect to PostgreSQL; fall back cleanly to SQLite if needed
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
    )
    # Test connection
    with engine.connect() as conn:
        logger.info("Connected successfully to primary database.")
except Exception as e:
    logger.warning(f"Could not connect to configured DATABASE_URL ({e}). Falling back to local SQLite database.")
    SQLITE_URL = "sqlite:///./anxietytwin.db"
    engine = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
