from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy.orm import relationship

from .database import Base

# ==================================================
# USER
# ==================================================


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
    )

    name = Column(
        String,
        nullable=False,
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password = Column(
        String,
        nullable=False,
    )

    bookmakers = relationship(
        "Bookmaker",
        back_populates="user",
    )

    bets = relationship(
        "Bet",
        back_populates="user",
    )

    bankroll = relationship(
        "Bankroll",
        back_populates="user",
        uselist=False,
    )


# ==================================================
# BOOKMAKER
# ==================================================


class Bookmaker(Base):
    __tablename__ = "bookmakers"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    name = Column(
        String,
        nullable=False,
    )

    balance = Column(
        Float,
        default=0,
    )

    user = relationship(
        "User",
        back_populates="bookmakers",
    )


# ==================================================
# BET
# ==================================================


class Bet(Base):
    __tablename__ = "bets"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    event = Column(
        String,
        nullable=False,
    )

    sport = Column(
        String,
        nullable=False,
    )

    bookmaker = Column(
        String,
        nullable=False,
    )

    market = Column(
        String,
        nullable=False,
    )

    odds = Column(
        Float,
        nullable=False,
    )

    stake = Column(
        Float,
        nullable=False,
    )

    potential_return = Column(
        Float,
        nullable=False,
    )

    profit = Column(
        Float,
        default=0,
    )

    status = Column(
        String,
        default="Pending",
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    user = relationship(
        "User",
        back_populates="bets",
    )


# ==================================================
# BANKROLL
# ==================================================


class Bankroll(Base):
    __tablename__ = "bankroll"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )

    balance = Column(
        Float,
        default=0,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = relationship(
        "User",
        back_populates="bankroll",
    )


# ==================================================
# ARBITRAGE OPPORTUNITY
# ==================================================


class ArbitrageOpportunity(Base):
    __tablename__ = "arbitrage_opportunities"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    scan_id = Column(
        String,
        index=True,
        nullable=False,
    )

    # --------------------------------------------
    # ADDED: without this there was no way to tell
    # which of the 8 scanned sports a saved
    # opportunity belonged to once run_scan()
    # started combining them into one table.
    # --------------------------------------------

    sport = Column(
        String,
        nullable=False,
        index=True,
        server_default="unknown",  # so this migration doesn't
        # break on tables that already have rows
    )

    league = Column(
        String,
        nullable=True,
    )

    event = Column(
        String,
        nullable=False,
    )

    selection = Column(
        String,
        nullable=True,  # relaxed: cross-book bets have no single
        # selection -- see `legs` below instead
    )

    bookmaker = Column(
        String,
        nullable=True,  # relaxed: cross-book bets span multiple
        # bookmakers, one per leg -- see `legs` below
    )
    bookmaker_link = Column(
        String,
        nullable=True,  # direct bookmaker/event/betslip URL when available
    )
    exchange = Column(
        String,
        nullable=False,
        default="Betfair",
    )

    back_odds = Column(
        Float,
        nullable=True,  # relaxed: not meaningful for cross-book
    )

    lay_odds = Column(
        Float,
        nullable=True,  # relaxed: not meaningful for cross-book
    )

    commission = Column(
        Float,
        nullable=True,  # relaxed: cross-book bets between plain
        # bookmakers typically have no commission at all
    )

    profit_percentage = Column(
        Float,
        nullable=False,
    )

    guaranteed_profit = Column(
        Float,
        nullable=False,
    )

    bookmaker_stake = Column(
        Float,
        nullable=True,  # relaxed: cross-book stake is split across
        # legs (see `legs` below) rather than one bookmaker stake
    )

    betfair_lay_stake = Column(
        Float,
        nullable=True,  # relaxed: no exchange leg in cross-book
    )

    lay_liability = Column(
        Float,
        nullable=True,  # relaxed: no exchange leg in cross-book
    )

    total_capital_required = Column(
        Float,
        nullable=True,  # relaxed: not populated for cross-book --
        # sum the `legs` stakes instead
    )

    # --------------------------------------------
    # ADDED: cross-book ("surebet") arbitrage has 2-3 legs, each
    # with its own bookmaker/odds/stake -- doesn't fit the single
    # bookmaker/back_odds/lay_odds columns above, which stay
    # populated (and this stays NULL) for ordinary back-lay bets.
    # Shape: [{selection, bookmaker, odds, stake, payout_if_wins}, ...]
    # --------------------------------------------

    legs = Column(
        JSONB,
        nullable=True,
    )

    start_time = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    scanned_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
