from app.services.odds_service import (
    get_soccer_events,
    group_duplicate_events,
    get_best_back_odds_for_group,
)
from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService
from app.engine.arbitrage_engine import find_back_lay_arbitrage


TARGET_TEXT = "aston villa"


def main():
    print("=" * 60)
    print("FULL ARBITRAGE PIPELINE TEST")
    print("=" * 60)

    # 1. Fetch Odds-API.net events
    events = get_soccer_events(100)

    groups = group_duplicate_events(events)

    group = next(
        (
            g
            for g in groups
            if TARGET_TEXT
            in g["event_name"].lower()
        ),
        None,
    )

    if not group:
        print("Target fixture not found.")
        return

    print("\nGrouped fixture:")
    print(group["event_name"])

    print("\nOdds API event IDs:")
    print(group["event_ids"])

    # 2. Best bookmaker BACK odds
    best_back = (
        get_best_back_odds_for_group(
            group
        )
    )

    print("\nBest bookmaker BACK odds:")

    for selection, info in best_back.items():
        print(
            f"{selection} | "
            f"{info['odds']} | "
            f"{info['bookmaker']}"
        )

    # 3. Betfair
    print("\nLogging into Betfair...")

    betfair = BetfairService()
    betfair.login()

    print("Betfair login successful.")

    betfair_events = betfair.get_events("1")

    print(
        f"Betfair soccer events: "
        f"{len(betfair_events)}"
    )

    # 4. Match fixture
    matched_event = (
        MatcherService.find_matching_event(
            group["event_name"],
            betfair_events,
            threshold=0.65,
            debug=True,
        )
    )

    if not matched_event:
        print(
            "\nNo Betfair event match."
        )
        return

    print(
        "\nMatched Betfair event:"
    )

    print(
        matched_event.event.name
    )

    # 5. Get Match Odds market
    markets = (
        betfair.get_match_odds_market(
            matched_event.event.id
        )
    )

    if not markets:
        print(
            "No Betfair MATCH_ODDS market."
        )
        return

    market = markets[0]

    # 6. Compare each selection
    print("\nComparing selections:")

    for selection_name, back_info in (
        best_back.items()
    ):

        matched_runner = (
            MatcherService.find_matching_runner(
                selection_name,
                market.runners,
                threshold=0.65,
                debug=True,
            )
        )

        if not matched_runner:
            print(
                f"\nNo Betfair runner for "
                f"{selection_name}"
            )
            continue

        lay_odds = (
            betfair
            .get_lay_price_for_selection(
                market.market_id,
                matched_runner.selection_id,
            )
        )

        print("\n" + "-" * 60)

        print(
            f"Selection: "
            f"{selection_name}"
        )

        print(
            f"Bookmaker: "
            f"{back_info['bookmaker']}"
        )

        print(
            f"Back odds: "
            f"{back_info['odds']}"
        )

        print(
            f"Betfair runner: "
            f"{matched_runner.runner_name}"
        )

        print(
            f"Lay odds: "
            f"{lay_odds}"
        )

        if lay_odds is None:
            print(
                "No available Betfair lay price."
            )
            continue

        result = (
            find_back_lay_arbitrage(
                event=group["event_name"],
                selection=selection_name,
                bookmaker=back_info[
                    "bookmaker"
                ],
                bookmaker_back_odds=(
                    back_info["odds"]
                ),
                exchange="Betfair",
                betfair_lay_odds=lay_odds,
                bookmaker_stake=100,
                commission=0.05,
            )
        )

        print(
            "Arbitrage result:"
        )

        print(result)

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()