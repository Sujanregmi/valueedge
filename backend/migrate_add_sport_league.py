"""
One-off migration: adds the sport / league columns to
arbitrage_opportunities.

Run this ONCE from your project root (with venv activated):

    python migrate_add_sport_league.py

Safe to run more than once -- each ALTER uses IF NOT EXISTS style
checks so re-running it won't error if the columns already exist.
"""

from sqlalchemy import text

from app.database import engine


STATEMENTS = [
    """
    ALTER TABLE arbitrage_opportunities
    ADD COLUMN IF NOT EXISTS sport VARCHAR NOT NULL DEFAULT 'unknown';
    """,
    """
    ALTER TABLE arbitrage_opportunities
    ADD COLUMN IF NOT EXISTS league VARCHAR;
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_arbitrage_opportunities_sport
    ON arbitrage_opportunities (sport);
    """,
]


def run():
    with engine.begin() as conn:
        for statement in STATEMENTS:
            print("Running:", statement.strip().splitlines()[0], "...")
            conn.execute(text(statement))

    print()
    print("Migration complete: sport + league columns are ready.")


if __name__ == "__main__":
    run()