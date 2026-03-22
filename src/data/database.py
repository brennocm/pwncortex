import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./pwncortex.db")

# Enforce DATABASE_URL in production
if os.environ.get("PWNCORTEX_ENV") == "production" and not os.environ.get(
    "DATABASE_URL"
):
    raise RuntimeError("DATABASE_URL is required in production environment.")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
