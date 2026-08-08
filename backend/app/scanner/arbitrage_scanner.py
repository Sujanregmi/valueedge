"""
Arbitrage Scanner
-----------------
Pipeline:

Odds API
    ↓
Best bookmaker back odds
    ↓
Betfair lay odds
    ↓
Matcher Service
    ↓
Arbitrage Engine
"""

from app.services.odds_service import get_odds
from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService
from app.engine.arbitrage_engine import find_back_lay_arbitrage


# Mapping from Odds API sport_key -> Betfair event type id
# Expand this as you support more sports.
SPORT_KEY_TO_EVENT_TYPE = {
    "soccer_uefa_champs_league_qualification": "1",
}


def get_best_back_odds(event: dict) -> dict:
    """
    Returns the highest bookmaker odds for each selection.

    Example:
    {
        "Arsenal": {
            "odds": 2.15,
            "bookmaker": "Bet365"
        }
    }
    """

    best = {}

    for bookmaker in event.get("bookmakers", []):

        bookmaker_key = bookmaker.get("key", "").lower()

        # Ignore Betfair Exchange
        if "betfair" in bookmaker_key:
            continue

        for market in bookmaker.get("markets", []):

            if market.get("key") != "h2h":
                continue

            for outcome in market.get("outcomes", []):

                name = outcome["name"]
                price = outcome["price"]

                if (
                    name not in best
                    or price > best[name]["odds"]
                ):
                    best[name] = {
                        "odds": price,
                        "bookmaker": bookmaker.get(
                            "title",
                            bookmaker.get("key")
                        )
                    }

    return best


def scan_for_arbitrage(
    bookmaker_stake: float = 100,
    commission: float = 0.05,
    min_profit_pct: float = 0.5,
):

    opportunities = []

    print("=" * 60)
    print("EDGEPULSE ARBITRAGE SCANNER")
    print("=" * 60)

    betfair = BetfairService()

    print("Logging into Betfair...")
    betfair.login()
    print("Betfair login successful.\n")

    all_events = []

    for sport_key, event_type_id in SPORT_KEY_TO_EVENT_TYPE.items():

        print(f"Fetching Odds API events: {sport_key}")

        try:

            sport_events = get_odds(sport_key)

            print(f"  {len(sport_events)} events found")

            all_events.extend(sport_events)

        except Exception as e:

            print(f"  Failed to fetch {sport_key}: {e}")

    if not all_events:

        print("\nNo Odds API events returned.")
        return []

    print(f"\nScanning {len(all_events)} events...\n")

    for odds_event in all_events:

        sport_key = odds_event.get("sport_key")
        event_type_id = SPORT_KEY_TO_EVENT_TYPE.get(sport_key)

        if not event_type_id:
            print(f"No Betfair mapping for {sport_key}")
            continue

        event_name = (
            f"{odds_event['home_team']} vs "
            f"{odds_event['away_team']}"
        )

        print("-" * 60)
        print(event_name)

        try:

            betfair_events = betfair.get_events(event_type_id)

            matched_event = MatcherService.find_matching_event(
                event_name,
                betfair_events,
            )

            if not matched_event:
                print("No Betfair event match.")
                continue

            print(f"Matched Betfair event: {matched_event.event.name}")

            markets = betfair.get_match_odds_market(
                matched_event.event.id
            )

            if not markets:
                print("No Match Odds market.")
                continue

            market = markets[0]

            best_back_odds = get_best_back_odds(odds_event)

            for selection_name, back_info in best_back_odds.items():

                matched_runner = (
                    MatcherService.find_matching_runner(
                        selection_name,
                        market.runners,
                    )
                )

                if not matched_runner:
                    continue

                lay_odds = betfair.get_lay_price_for_selection(
                    market.market_id,
                    matched_runner.selection_id,
                )
                print(
    f"{selection_name} | "
    f"Back: {back_info['odds']} ({back_info['bookmaker']}) | "
    f"Lay: {lay_odds}"
)
                result = find_back_lay_arbitrage(...)
                print(result)

                if lay_odds is None:
                    continue

                result = find_back_lay_arbitrage(
                    event=event_name,
                    selection=selection_name,
                    bookmaker=back_info["bookmaker"],
                    bookmaker_back_odds=back_info["odds"],
                    exchange="Betfair",
                    betfair_lay_odds=lay_odds,
                    bookmaker_stake=bookmaker_stake,
                    commission=commission,
                )

                if not result:
                    continue

                if result["profit_percentage"] >= min_profit_pct:

                    opportunities.append(result)

                    print(
                        f"✓ {selection_name} | "
                        f"{result['profit_percentage']}%"
                    )

        except Exception as e:

            print(f"Error scanning {event_name}: {e}")

    opportunities.sort(
        key=lambda x: x["profit_percentage"],
        reverse=True,
    )

    print("\n" + "=" * 60)
    print(f"Found {len(opportunities)} arbitrage opportunities")
    print("=" * 60)

    return opportunities


if __name__ == "__main__":

    results = scan_for_arbitrage(
        bookmaker_stake=100,
        commission=0.05,
        min_profit_pct=0.5,
    )

    print()

    for result in results:

        print(
            f"{result['event']} | "
            f"{result['selection']} | "
            f"{result['profit_percentage']}% | "
            f"${result['guaranteed_profit']}"
        )