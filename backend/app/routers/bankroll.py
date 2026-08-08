from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models


router = APIRouter(
    prefix="/bankroll",
    tags=["Bankroll"]
)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()



# Get user bankroll
@router.get("/{user_id}")
def get_bankroll(
    user_id:int,
    db:Session = Depends(get_db)
):

    bankroll = db.query(
        models.Bankroll
    ).filter(
        models.Bankroll.user_id == user_id
    ).first()


    return bankroll