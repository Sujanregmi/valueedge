from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import Bookmaker, User
from ..dependencies import get_db, get_current_user

router = APIRouter(prefix="/bookmakers", tags=["Bookmakers"])


class BookmakerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    balance: float = Field(default=0, ge=0)


class BookmakerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    balance: float | None = Field(default=None, ge=0)


class BookmakerOut(BaseModel):
    id: int
    name: str
    balance: float

    class Config:
        from_attributes = True


def _get_owned_bookmaker(
    db: Session, bookmaker_id: int, current_user: User
) -> Bookmaker:
    bookmaker = (
        db.query(Bookmaker)
        .filter(
            Bookmaker.id == bookmaker_id,
            Bookmaker.user_id == current_user.id,
        )
        .first()
    )

    if not bookmaker:
        # 404, not 403 -- don't confirm to a caller whether a
        # bookmaker ID belonging to someone else even exists.
        raise HTTPException(status_code=404, detail="Bookmaker not found")

    return bookmaker


@router.get("", response_model=list[BookmakerOut])
def list_bookmakers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Bookmaker)
        .filter(Bookmaker.user_id == current_user.id)
        .order_by(Bookmaker.name)
        .all()
    )


@router.post("", response_model=BookmakerOut, status_code=status.HTTP_201_CREATED)
def create_bookmaker(
    payload: BookmakerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Bookmaker)
        .filter(
            Bookmaker.user_id == current_user.id,
            Bookmaker.name == payload.name,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a bookmaker with this name",
        )

    bookmaker = Bookmaker(
        user_id=current_user.id,
        name=payload.name,
        balance=payload.balance,
    )

    db.add(bookmaker)
    db.commit()
    db.refresh(bookmaker)

    return bookmaker


@router.patch("/{bookmaker_id}", response_model=BookmakerOut)
def update_bookmaker(
    bookmaker_id: int,
    payload: BookmakerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmaker = _get_owned_bookmaker(db, bookmaker_id, current_user)

    if payload.name is not None:
        bookmaker.name = payload.name

    if payload.balance is not None:
        bookmaker.balance = payload.balance

    db.commit()
    db.refresh(bookmaker)

    return bookmaker


@router.delete("/{bookmaker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmaker(
    bookmaker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmaker = _get_owned_bookmaker(db, bookmaker_id, current_user)

    db.delete(bookmaker)
    db.commit()

    return None

@router.get("/known-names")
def known_bookmaker_names(
    current_user: User = Depends(get_current_user),
):
    """
    Australian bookmakers supported by The Odds API.

    These keys/titles correspond to the official AU bookmaker
    list used by The Odds API.
    """

    bookmakers = [
        {
            "key": "betfair_ex_au",
            "name": "Betfair Exchange",
        },
        {
            "key": "betr_au",
            "name": "Betr",
        },
        {
            "key": "betright",
            "name": "Bet Right",
        },
        {
            "key": "bet365_au",
            "name": "Bet365 AU",
        },
        {
            "key": "dabble_au",
            "name": "Dabble AU",
        },
        {
            "key": "ladbrokes_au",
            "name": "Ladbrokes",
        },
        {
            "key": "neds",
            "name": "Neds",
        },
        {
            "key": "playup",
            "name": "PlayUp",
        },
        {
            "key": "pointsbetau",
            "name": "PointsBet (AU)",
        },
        {
            "key": "sportsbet",
            "name": "SportsBet",
        },
        {
            "key": "tab",
            "name": "TAB",
        },
        {
            "key": "tabtouch",
            "name": "TABtouch",
        },
        {
            "key": "unibet",
            "name": "Unibet",
        },
    ]

    return {
        "region": "au",
        "bookmakers": bookmakers,
    }