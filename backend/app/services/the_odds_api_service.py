import os

import requests
from dotenv import load_dotenv


load_dotenv()


THE_ODDS_API_KEY = os.getenv(
    "THE_ODDS_API_KEY"
)

BASE_URL = (
    "https://api.the-odds-api.com/v4"
)


def _check_key():
    if not THE_ODDS_API_KEY:
        raise ValueError(
            "THE_ODDS_API_KEY is missing from .env"
        )


def get_sports() -> list[dict]:
    """
    Free endpoint.
    Does not consume usage credits.
    """

    _check_key()

    response = requests.get(
        f"{BASE_URL}/sports",
        params={
            "apiKey":
                THE_ODDS_API_KEY,
        },
        timeout=30,
    )

    response.raise_for_status()

    print(
        "Quota remaining:",
        response.headers.get(
            "x-requests-remaining"
        ),
    )

    return response.json()


def get_odds(
    sport_key: str,
    commence_from: str | None = None,
    commence_to: str | None = None,
) -> list[dict]:

    _check_key()

    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "au",
        "markets": "h2h",
        "oddsFormat": "decimal",
        "dateFormat": "iso",
    }

    if commence_from:
        params["commenceTimeFrom"] = commence_from

    if commence_to:
        params["commenceTimeTo"] = commence_to

    response = requests.get(
        f"{BASE_URL}/sports/"
        f"{sport_key}/odds",
        params=params,
        timeout=30,
    )

    print(
        f"The Odds API: {sport_key}"
    )

    print(
        "Status:",
        response.status_code,
    )

    print(
        "Cost:",
        response.headers.get(
            "x-requests-last"
        ),
        "| Used:",
        response.headers.get(
            "x-requests-used"
        ),
        "| Remaining:",
        response.headers.get(
            "x-requests-remaining"
        ),
    )

    response.raise_for_status()

    return response.json()