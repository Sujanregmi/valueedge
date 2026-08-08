from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy import DateTime
from .database import Base

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    hashed_password = Column(
        String,
        nullable=False
    )


    bookmakers = relationship(
        "Bookmaker",
        back_populates="user"
    )
    bets = relationship(
    "Bet",
    back_populates="user"
)

bankroll = relationship(
    "Bankroll",
    back_populates="user",
    uselist=False
)


class Bookmaker(Base):

    __tablename__ = "bookmakers"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )


    name = Column(
        String,
        nullable=False
    )


    balance = Column(
        Float,
        default=0
    )


    user = relationship(
        "User",
        back_populates="bookmakers"
    )




class Bet(Base):

    __tablename__ = "bets"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )


    event = Column(
        String,
        nullable=False
    )


    sport = Column(
        String,
        nullable=False
    )


    bookmaker = Column(
        String,
        nullable=False
    )


    market = Column(
        String,
        nullable=False
    )


    odds = Column(
        Float,
        nullable=False
    )


    stake = Column(
        Float,
        nullable=False
    )


    potential_return = Column(
        Float,
        nullable=False
    )


    profit = Column(
        Float,
        default=0
    )


    status = Column(
        String,
        default="Pending"
    )


    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


    user = relationship(
        "User",
        back_populates="bets"
    )

class Bankroll(Base):

    __tablename__ = "bankroll"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )


    balance = Column(
        Float,
        default=0
    )


    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )


    user = relationship(
        "User",
        back_populates="bankroll"
    )

