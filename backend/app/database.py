import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# --------------------------------------------------
# SECURITY: never hardcode DB credentials in source.
# Previously this was:
#   DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/edgepulse"
# which puts your Postgres password directly in version
# control. Move it to your .env file instead:
#
#   DATABASE_URL=postgresql://postgres:Sanjaya77@localhost:5432/edgepulse
#
# and make sure .env is in .gitignore. If this file was ever
# committed with the real password, rotate the Postgres
# password -- removing it from a future commit doesn't remove
# it from git history.
# --------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing from the environment (.env)")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # avoid stale-connection errors between 30-min scans
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()