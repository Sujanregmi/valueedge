from sqlalchemy import text

from app.database import engine


def add_bookmaker_link_column():
    sql = text("""
        ALTER TABLE arbitrage_opportunities
        ADD COLUMN IF NOT EXISTS bookmaker_link VARCHAR;
    """)

    with engine.begin() as connection:
        connection.execute(sql)

    print("bookmaker_link column is ready.")


if __name__ == "__main__":
    add_bookmaker_link_column()