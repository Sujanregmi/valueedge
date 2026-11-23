import os

import requests
from dotenv import load_dotenv

import time

load_dotenv()


THE_ODDS_API_KEY = os.getenv("THE_ODDS_API_KEY")

BASE_URL = "https://api.the-odds-api.com/v4"


def _check_key():
    if not THE_ODDS_API_KEY:
        raise ValueError("THE_ODDS_API_KEY is missing from .env")


def get_sports() -> list[dict]:
    """
    Free endpoint.
    Does not consume usage credits.
    """

    _check_key()

    response = requests.get(
        f"{BASE_URL}/sports",
        params={
            "apiKey": THE_ODDS_API_KEY,
        },
        timeout=30,
    )

    response.raise_for_status()

    print(
        "Quota remaining:",
        response.headers.get("x-requests-remaining"),
    )

    return response.json()


def get_events(
    sport_key: str,
    commence_from: str | None = None,
    commence_to: str | None = None,
) -> list[dict]:

    _check_key()

    params = params = {
        "apiKey": THE_ODDS_API_KEY,
        "dateFormat": "iso",
    }

    if commence_from:
        params["commenceTimeFrom"] = commence_from

    if commence_to:
        params["commenceTimeTo"] = commence_to

    response = requests.get(
        f"{BASE_URL}/sports/{sport_key}/events",
        params=params,
        timeout=30,
    )

    print(f"The Odds API events: {sport_key}")
    print("Status:", response.status_code)

    response.raise_for_status()

    events = response.json()

    print("Events:", len(events))

    return events


def get_odds(
    sport_key: str,
    commence_from: str | None = None,
    commence_to: str | None = None,
    markets: str = "h2h,totals",
) -> list[dict]:

    _check_key()

    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "au",
        "markets": markets,
        "oddsFormat": "decimal",
        "dateFormat": "iso",
        "includeLinks": "true",
    }

    if commence_from:
        params["commenceTimeFrom"] = commence_from

    if commence_to:
        params["commenceTimeTo"] = commence_to

    response = requests.get(
        f"{BASE_URL}/sports/{sport_key}/odds",
        params=params,
        timeout=30,
    )

    print(f"The Odds API: {sport_key}")

    print(
        "Status:",
        response.status_code,
    )

    print(
        "Cost:",
        response.headers.get("x-requests-last"),
        "| Used:",
        response.headers.get("x-requests-used"),
        "| Remaining:",
        response.headers.get("x-requests-remaining"),
    )

    response.raise_for_status()

    return response.json()


"""
ADD THIS to your existing app/services/the_odds_api_service.py --
don't replace the file, just append this function below your
existing get_sports() and get_odds() functions. It reuses get_sports()
which is already there.
"""


# Cache the sports list briefly rather than hitting the network on
# every single sport's scan -- league lists change rarely, and even
# though /v4/sports is free (no quota cost), there's no reason to
# make 8 network round-trips per scan cycle (one per sport) when the
# underlying data is identical across all of them.
_sports_cache: dict = {"data": None, "fetched_at": 0.0}
_SPORTS_CACHE_TTL_SECONDS = 60 * 60  # 1 hour


def get_all_sport_keys(prefix: str | None = None) -> list[str]:
    """
    Returns sport_key values from the free /v4/sports endpoint,
    optionally filtered to those starting with `prefix` (e.g.
    "soccer_" returns every soccer league Odds API currently has
    in-season -- EPL, La Liga, Serie A, Bundesliga, Champions League,
    etc., whatever they're actively listing right now).

    Cached for _SPORTS_CACHE_TTL_SECONDS. get_sports() already only
    returns in-season sports by default (no all=true param), so this
    naturally excludes leagues that are between seasons -- no wasted
    calls scanning a league with zero fixtures.
    """

    now = time.time()

    cache_is_stale = (
        _sports_cache["data"] is None
        or (now - _sports_cache["fetched_at"]) > _SPORTS_CACHE_TTL_SECONDS
    )

    if cache_is_stale:
        _sports_cache["data"] = get_sports()
        _sports_cache["fetched_at"] = now

    all_keys = [sport["key"] for sport in _sports_cache["data"]]
    # Sport keys representing futures / outright winner markets.


# ValueEdge only scans individual match events.
    EXCLUDED_SPORT_KEY_TERMS = (
        "championship_winner",
        "winner",
        "outright",
        "futures",
    )

    if prefix:
        return [
            key
            for key in all_keys
            if key.startswith(prefix)
            and not any(excluded in key.lower() for excluded in EXCLUDED_SPORT_KEY_TERMS)
        ]

    return [
        key
        for key in all_keys
        if not any(excluded in key.lower() for excluded in EXCLUDED_SPORT_KEY_TERMS)
    ]


def get_event_markets(
    sport_key: str,
    event_id: str,
    markets: str = "h2h,spreads,totals",
) -> dict:

    _check_key()

    response = requests.get(
        f"{BASE_URL}/sports/{sport_key}/events/{event_id}/odds",
        params={
            "apiKey": THE_ODDS_API_KEY,
            "regions": "au",
            "markets": markets,
            "oddsFormat": "decimal",
            "dateFormat": "iso",
            "includeLinks": "true",
        },
        timeout=30,
    )

    print("Status:", response.status_code)

    print(
        "Cost:",
        response.headers.get("x-requests-last"),
        "| Remaining:",
        response.headers.get("x-requests-remaining"),
    )

    response.raise_for_status()

    return response.json()
