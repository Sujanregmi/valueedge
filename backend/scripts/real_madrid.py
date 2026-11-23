from app.services.odds_service import (
    get_soccer_events,
    group_duplicate_events,
    get_best_back_odds_for_group,
)

from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService
from app.engine.arbitrage_engine import find_back_lay_arbitrage


TARGET = "espanyol"


def main():

    events = get_soccer_events(
        page_size=100,
        max_events=None,
    )
    
    groups = group_duplicate_events(
        events
    )

    matches = [
        g
        for g in groups
        if TARGET in g["event_name"].lower()
        and "madrid" in g["event_name"].lower()
    ]

    if not matches:
        print(
            "Espanyol vs Madrid not found "
            "in Odds-API.net event batch."
        )
        return

    for group in matches:

        print("\n" + "=" * 60)

        print(
            "ODDS FIXTURE:",
            group["event_name"],
        )

        print(
            "EVENT IDS:",
            group["event_ids"],
        )

        print(
            "BOOKMAKERS:",
            group["bookmakers"],
        )

        if "betnation" not in [
            str(x).lower()
            for x in group["bookmakers"]
        ]:
            print(
                "WARNING: Betnation is not "
                "listed for this grouped fixture."
            )

        best_back = (
            get_best_back_odds_for_group(
                group
            )
        )

        print(
            "\nBEST BOOKMAKER ODDS:"
        )

        for selection, info in (
            best_back.items()
        ):
            print(
                selection,
                "|",
                info["odds"],
                "|",
                info["bookmaker"],
            )

        print(
            "\nLogging into Betfair..."
        )

        betfair = BetfairService()
        betfair.login()

        betfair_events = (
            betfair.get_events("1")
        )

        matched_event = (
            MatcherService
            .find_matching_event(
                group["event_name"],
                betfair_events,
                threshold=0.65,
                debug=True,
            )
        )

        if not matched_event:
            print(
                "NO BETFAIR EVENT MATCH"
            )
            continue

        print(
            "\nBETFAIR MATCH:",
            matched_event.event.name,
        )

        markets = (
            betfair
            .get_match_odds_market(
                matched_event.event.id
            )
        )

        if not markets:
            print(
                "NO BETFAIR MATCH_ODDS MARKET"
            )
            continue

        market = markets[0]

        books = (
            betfair.get_market_book(
                market.market_id
            )
        )

        if not books:
            print(
                "NO BETFAIR MARKET BOOK"
            )
            continue

        market_book = books[0]

        print(
            "\nARB CHECK:"
        )

        for (
            selection_name,
            back_info,
        ) in best_back.items():

            runner = (
                MatcherService
                .find_matching_runner(
                    selection_name,
                    market.runners,
                    threshold=0.65,
                    debug=True,
                )
            )

            if not runner:
                print(
                    selection_name,
                    "-> NO RUNNER MATCH",
                )
                continue

            lay_odds = (
                betfair
                .get_lay_price_for_selection(
                    market.market_id,
                    runner.selection_id,
                    market_book=market_book,
                )
            )

            print(
                selection_name,
                "| BACK",
                back_info["odds"],
                back_info["bookmaker"],
                "| LAY",
                lay_odds,
            )

            if lay_odds is None:
                continue

            result = (
                find_back_lay_arbitrage(
                    event=group["event_name"],
                    selection=selection_name,
                    bookmaker=back_info[
                        "bookmaker"
                    ],
                    bookmaker_back_odds=
                        back_info["odds"],
                    exchange="Betfair",
                    betfair_lay_odds=
                        lay_odds,
                    bookmaker_stake=100,
                    commission=0.05,
                )
            )

            print(
                "RESULT:",
                result,
            )


if __name__ == "__main__":
    main()