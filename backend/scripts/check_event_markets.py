from app.services.the_odds_api_service import (
    get_events,
    get_event_markets,
)


SPORT_KEY = "tennis_atp_us_open"


events = get_events(SPORT_KEY)

if not events:
    print("No events available.")
    raise SystemExit


# Just inspect the first available event
event = events[0]

event_id = event["id"]
home_team = event.get("home_team", "")
away_team = event.get("away_team", "")


print()
print("=" * 80)
print("EVENT")
print("=" * 80)

print(f"{home_team} vs {away_team}")
print("Event ID:", event_id)
print("Sport:", SPORT_KEY)


data = get_event_markets(
    sport_key=SPORT_KEY,
    event_id=event_id,
)


print()
print("=" * 80)
print("MARKETS BY BOOKMAKER")
print("=" * 80)


all_markets = set()

for bookmaker in data.get("bookmakers", []):

    bookmaker_name = bookmaker.get(
        "title",
        bookmaker.get("key", "Unknown"),
    )

    print()
    print(bookmaker_name)
    print("-" * 50)

    for market in bookmaker.get("markets", []):

        market_key = market.get("key")

        if not market_key:
            continue

        all_markets.add(market_key)

        print(market_key)


print()
print("=" * 80)
print("ALL UNIQUE MARKETS")
print("=" * 80)

for market_key in sorted(all_markets):
    print(market_key)


print()
print("TOTAL UNIQUE MARKETS:", len(all_markets))