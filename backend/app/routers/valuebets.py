from fastapi import APIRouter

from ..services.odds_service import get_odds
from ..services.value_engine import find_value_bets



router = APIRouter(
    prefix="/value-bets",
    tags=["Value Bets"]
)



@router.get("/")
def get_value_bets():

    odds = get_odds()


    value_bets = find_value_bets(
        odds
    )


    return value_bets