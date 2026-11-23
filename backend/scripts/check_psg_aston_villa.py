from app.services.odds_service import get_odds
from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService
from app.scanner.arbitrage_scanner import get_best_back_odds
from app.engine.arbitrage_engine import find_back_lay_arbitrage


TARGET_EVENT = "PSG vs Aston Villa"


def main():
    print("=" * 60)
    print("PSG vs ASTON VILLA DIAGNOSTIC")
    print("=" * 60)

    # 1. Check Odds API competitions
    print("\nChecking Odds API...")

    found_odds_event = None
    found_sport_key = None

    # Try a few likely keys first
    sport_keys = [
        "soccer_uefa_champs_league",
        "soccer_uefa_champs_league_qualification",
        "soccer_uefa_europa_league",
        "soccer_uefa_nations_league",
    ]

    for sport_key in sport_keys:
        try:
            events = get_odds(sport_key)

            if not isinstance(events, list):
                continue

            for event in events:
                event_name = (
                    f"{event.get('home_team')} vs "
                    f"{event.get('away_team')}"
                )

                if MatcherService.events_match(
                    TARGET_EVENT,
                    event_name,
                    threshold=0.65,
                ):
                    found_odds_event = event
                    found_sport_key = sport_key
                    break

            if found_odds_event:
                break

        except Exception as e:
            print(
                f"Odds API error for {sport_key}: {e}"
            )

    if not found_odds_event:
        print("\nRESULT:")
        print("PSG vs Aston Villa NOT found in Odds API keys checked.")
        print("This is likely why the main scanner misses it.")
        return

    print("\nOdds API event found:")
    print(
        f"{found_odds_event['home_team']} vs "
        f"{found_odds_event['away_team']}"
    )
    print(f"Sport key: {found_sport_key}")

    best_back_odds = get_best_back_odds(
        found_odds_event
    )

    print("\nBest bookmaker odds:")

    for selection, info in best_back_odds.items():
        print(
            f"{selection} | "
            f"{info['bookmaker']} | "
            f"{info['odds']}"
        )

    # 2. Check Betfair
    print("\nChecking Betfair...")

    betfair = BetfairService()
    betfair.login()

    betfair_events = betfair.get_events("1")

    matched_event = MatcherService.find_matching_event(
        TARGET_EVENT,
        betfair_events,
        threshold=0.65,
        debug=True,
    )

    if not matched_event:
        print("\nRESULT:")
        print("No Betfair match for PSG vs Aston Villa.")
        return

    print(
        "\nMatched Betfair event:",
        matched_event.event.name,
    )

    markets = betfair.get_match_odds_market(
        matched_event.event.id
    )

    if not markets:
        print("No MATCH_ODDS market found.")
        return

    market = markets[0]

    # 3. Check PSG specifically
    target_selection = "PSG"

    matched_runner = MatcherService.find_matching_runner(
        target_selection,
        market.runners,
        threshold=0.65,
        debug=True,
    )

    if not matched_runner:
        print("No PSG runner match.")
        return

    lay_odds = betfair.get_lay_price_for_selection(
        market.market_id,
        matched_runner.selection_id,
    )

    print(f"\nBetfair PSG lay odds: {lay_odds}")

    # 4. Compare with bookmaker back odds
    psg_back = None

    for selection, info in best_back_odds.items():
        if MatcherService.selection_matches(
            "PSG",
            selection,
            threshold=0.65,
        ):
            psg_back = info
            break

    if not psg_back:
        print("No PSG bookmaker back odds found.")
        return

    print(
        f"Best PSG back odds: "
        f"{psg_back['odds']} "
        f"({psg_back['bookmaker']})"
    )

    if lay_odds is None:
        print("No Betfair lay price available.")
        return

    result = find_back_lay_arbitrage(
        event=TARGET_EVENT,
        selection="PSG",
        bookmaker=psg_back["bookmaker"],
        bookmaker_back_odds=psg_back["odds"],
        exchange="Betfair",
        betfair_lay_odds=lay_odds,
        bookmaker_stake=100,
        commission=0.06,
    )

    print("\nArbitrage result:")
    print(result)


if __name__ == "__main__":
    main()