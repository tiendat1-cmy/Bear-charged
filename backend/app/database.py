"""
Khởi tạo SQLAlchemy engine, SessionLocal và Base.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency cấp 1 session DB cho mỗi request, tự đóng lại sau khi xong."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
