from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models


router = APIRouter(
    prefix="/bookmakers",
    tags=["Bookmakers"]
)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()



@router.get("/{user_id}")
def get_bookmakers(
    user_id:int,
    db:Session=Depends(get_db)
):

    bookmakers = db.query(
        models.Bookmaker
    ).filter(
        models.Bookmaker.user_id == user_id
    ).all()


    return bookmakers