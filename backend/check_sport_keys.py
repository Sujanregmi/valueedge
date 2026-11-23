"""
Shows exactly which soccer leagues arb_scanner.py's discovery
mechanism will fetch right now, and estimates the daily API request
cost at your current scan interval.

Uses GET /v4/sports, which the API documents as NOT costing usage
credits -- safe to run as often as you like.

Run from your project root (venv activated):
    python check_sport_keys.py
"""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("THE_ODDS_API_KEY")

if not API_KEY:
    raise ValueError("THE_ODDS_API_KEY is missing from the environment (.env)")

# Match arb_scanner.py's SCAN_INTERVAL to get an accurate daily
# request estimate -- update this if you change the schedule.
SCAN_INTERVAL_MINUTES = 30


def run():
    response = requests.get(
        "https://api.the-odds-api.com/v4/sports",
        params={"apiKey": API_KEY},  # no all=true -- in-season only,
        # matching what get_all_sport_keys() actually uses
        timeout=30,
    )
    response.raise_for_status()

    all_sports = response.json()
    soccer_leagues = [s for s in all_sports if s["key"].startswith("soccer_")]

    print(f"Found {len(soccer_leagues)} in-season soccer leagues right now:\n")

    for sport in sorted(soccer_leagues, key=lambda s: s["title"]):
        print(f"  {sport['key']:35s} -> {sport['title']}")

    scans_per_day = (24 * 60) / SCAN_INTERVAL_MINUTES
    daily_requests = len(soccer_leagues) * scans_per_day

    print()
    print(
        f"At a {SCAN_INTERVAL_MINUTES}-min scan interval, that's "
        f"~{daily_requests:.0f} Odds API requests/day for soccer ALONE."
    )
    print("Check that against your plan's daily/monthly quota before relying on this.")


if __name__ == "__main__":
    run()