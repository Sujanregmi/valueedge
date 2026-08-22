from fastapi import APIRouter

from ..services.odds_service import get_soccer_events


router = APIRouter(
    prefix="/odds",
    tags=["Odds"],
)


@router.get("/")
def get_odds_endpoint(
    limit: int = 100,
):
    events = get_soccer_events(
        limit=limit
    )

    return {
        "count": len(events),
        "events": events,
    }