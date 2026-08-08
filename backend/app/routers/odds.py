from fastapi import APIRouter

from ..services.odds_service import get_odds


router = APIRouter(
    prefix="/odds",
    tags=["Odds"]
)


@router.get("/")
def odds():

    return get_odds()