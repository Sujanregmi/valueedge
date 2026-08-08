from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models


router = APIRouter(
    prefix="/bets",
    tags=["Bets"]
)



def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()



# Get all user bets
@router.get("/{user_id}")
def get_bets(
    user_id:int,
    db:Session = Depends(get_db)
):

    bets = db.query(
        models.Bet
    ).filter(
        models.Bet.user_id == user_id
    ).all()


    return bets