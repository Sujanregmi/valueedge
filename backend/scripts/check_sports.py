"""
Run this once to discover the real IDs you need for
SPORT_KEY_TO_EVENT_TYPE in arbitrage_scanner.py.

Usage: python -m app.check_sports
(adjust the module path to wherever you place this file)
"""

import os
import requests
from dotenv import load_dotenv
from app.services.betfair_service import BetfairService
print("SCRIPT STARTED")
load_dotenv()


def list_betfair_soccer_event_type():
    betfair = BetfairService()
    betfair.login()
    print("LOGIN OK")
    event_types = betfair.get_event_types()

    print("\n--- Betfair Event Types matching 'soccer' ---")
    for et in event_types:
        name = et.event_type.name.lower()
        if "soccer" in name or "football" in name:
            print(f"  name={et.event_type.name!r}  id={et.event_type.id}")


def list_odds_api_soccer_sports():
    api_key = os.getenv("ODDS_API_KEY")
    url = "https://api.the-odds-api.com/v4/sports"
    params = {"apiKey": api_key, "all": "true"}

    response = requests.get(url, params=params)
    sports = response.json()

    print("\n--- Odds API sport_keys with group 'Soccer' ---")
    for s in sports:
        if s.get("group") == "Soccer":
            print(f"  key={s['key']!r}  title={s['title']!r}  active={s['active']}")


if __name__ == "__main__":
    list_betfair_soccer_event_type()
    list_odds_api_soccer_sports()