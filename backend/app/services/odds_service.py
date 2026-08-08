import os
import requests
from dotenv import load_dotenv


load_dotenv()


API_KEY = os.getenv("ODDS_API_KEY")


BASE_URL = "https://api.the-odds-api.com/v4"


def get_odds(sport_key: str = "upcoming"):
    """
    Fetch odds for a specific sport (e.g. "soccer_epl"), or the general
    "upcoming" feed (whatever's happening soonest across all sports) if
    no sport_key is given.
    """

    url = f"{BASE_URL}/sports/{sport_key}/odds"

    params = {
        "apiKey": API_KEY,
        "regions": "au",
        "markets": "h2h",
        "oddsFormat": "decimal"
    }

    response = requests.get(
        url,
        params=params
    )

    return response.json()