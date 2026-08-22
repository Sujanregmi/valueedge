"""
EdgePulse Arbitrage Scanner

Pipeline:

Odds-API.net events
    ->
Group duplicate fixtures
    ->
Strict fixture match to Betfair
    ->
Fetch bookmaker snapshots concurrently
    ->
Best bookmaker BACK odds
    ->
Betfair market books in batches
    ->
Betfair LAY odds
    ->
Arbitrage Engine
"""

from datetime import datetime, timezone

# your other imports...
from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)


from app.services.betfair_service import (
    BetfairService,
)

from app.services.matcher_service import (
    MatcherService,
)

from app.engine.arbitrage_engine import (
    find_back_lay_arbitrage,
)

from app.services.odds_service import (
    get_sport_events,
    group_duplicate_events,
    get_best_back_odds_for_group,
)

# ==================================================
# CONFIG
# ==================================================

SPORT_CONFIG = {
    "soccer": {
        "name": "Soccer",
        "betfair_event_type_id": "1",
    },
    "tennis": {
        "name": "Tennis",
        "betfair_event_type_id": "2",
    },
    "basketball": {
        "name": "Basketball",
        "betfair_event_type_id": "7522",
    },
    "ice hockey": {
        "name": "Ice Hockey",
        "betfair_event_type_id": "7524",
    },
    "rugby league": {
        "name": "Rugby League",
        "betfair_event_type_id": "1477",
    },
    "aussie rules": {
        "name": "Australian Rules",
        "betfair_event_type_id": "61420",
    },
    "baseball": {
        "name": "Baseball",
        "betfair_event_type_id": "7511",
    },
    "american football": {
        "name": "American Football",
        "betfair_event_type_id": "6423",
    },
}

MAX_SNAPSHOT_WORKERS = 6

STRICT_EVENT_MATCH_THRESHOLD = 0.82

STRICT_RUNNER_MATCH_THRESHOLD = 0.82


# ==================================================
# BOOKMAKER SNAPSHOT WORKER
# ==================================================


def _prepare_fixture(
    group: dict,
):
    """
    Fetch bookmaker odds for one grouped fixture.

    Runs concurrently inside ThreadPoolExecutor.
    """

    try:
        best_back_odds = get_best_back_odds_for_group(group)

        return {
            "group": group,
            "best_back_odds": best_back_odds,
            "error": None,
        }

    except Exception as exc:

        return {
            "group": group,
            "best_back_odds": {},
            "error": str(exc),
        }

    # ==================================================
    # MAIN ARBITRAGE SCANNER
    # ==================================================


def scan_for_arbitrage(
    sport: str = "soccer",
    bookmaker_stake: float = 100,
    commission: float = 0.05,
    min_profit_pct: float = 0.5,
    debug_matching: bool = False,
    event_limit: int | None = None,
):
    opportunities = []
    matched_events_count = 0

    sport_config = SPORT_CONFIG.get(sport)

    if not sport_config:
        raise ValueError(f"Unsupported sport: {sport}")

    betfair_event_type_id = sport_config["betfair_event_type_id"]

    sport_name = sport_config["name"]

    print("=" * 60)
    print(f"EDGEPULSE ARBITRAGE SCANNER - " f"{sport_name}")
    print("=" * 60)

    # ==================================================
    # 1. BETFAIR EVENTS
    # ==================================================

    betfair = BetfairService()

    print(f"Logging into Betfair for " f"{sport_name}...")

    try:
        betfair.login()

        betfair_events = betfair.get_events(betfair_event_type_id)

    except Exception as exc:

        print(
            f"Failed to fetch Betfair " f"{sport_name} events:",
            exc,
        )

        return {
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
        }

    print(f"Betfair returned " f"{len(betfair_events)} " f"{sport_name} events.\n")

    # ==================================================
    # 2. ODDS-API.NET EVENTS
    # ==================================================

    if event_limit is None:

        print(f"Fetching ALL available " f"Odds-API.net {sport} records...")

    else:

        print(f"Fetching up to " f"{event_limit} " f"Odds-API.net {sport} records...")

    try:
        raw_events = get_sport_events(
            sport=sport,
            max_events=event_limit,
        )

    except Exception as exc:

        print(
            f"Failed to fetch " f"Odds-API.net {sport} events:",
            exc,
        )

        return {
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
        }

    grouped_events = group_duplicate_events(raw_events)

    print(f"Odds-API.net returned " f"{len(raw_events)} " f"{sport} records.")

    print(f"Grouped into " f"{len(grouped_events)} " f"real {sport} fixtures.\n")

    # ==================================================
    # 3. STRICT FIXTURE MATCHING
    # ==================================================

    matched_fixtures = []

    for group in grouped_events:

        event_name = group.get(
            "event_name",
            "",
        )

        league = group.get(
            "league",
            "",
        )

        start_time = group.get("start_time")

        # ------------------------------------------
        # IGNORE LIVE / ALREADY STARTED EVENTS
        # ------------------------------------------

        if start_time:

            now_ts = datetime.now(timezone.utc).timestamp()

            if float(start_time) <= (now_ts + 120):
                continue

        if not event_name:
            continue

        matched_event = MatcherService.find_matching_event(
            odds_event_name=event_name,
            betfair_events=betfair_events,
            odds_league=league,
            odds_start_time=start_time,
            sport=sport,
            threshold=STRICT_EVENT_MATCH_THRESHOLD,
            debug=debug_matching,
        )

        if not matched_event:

            if debug_matching:

                print(
                    "REJECTED:",
                    event_name,
                )

            continue

        matched_events_count += 1

        matched_fixtures.append(
            {
                "group": group,
                "betfair_event": matched_event,
            }
        )

    print(
        f"Matched "
        f"{len(matched_fixtures)} "
        f"verified {sport} fixtures "
        f"to Betfair."
    )

    if not matched_fixtures:

        return {
            "sport": sport,
            "sport_name": sport_name,
            "scanned_events": len(grouped_events),
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
        }
    # ==================================================
    # 4. FETCH BOOKMAKER SNAPSHOTS
    # ==================================================

    print()

    print(
        f"Fetching bookmaker snapshots "
        f"with "
        f"{MAX_SNAPSHOT_WORKERS} "
        f"workers..."
    )

    fixture_odds = {}

    with ThreadPoolExecutor(max_workers=MAX_SNAPSHOT_WORKERS) as executor:

        future_map = {}

        for item in matched_fixtures:

            group = item["group"]

            future = executor.submit(
                _prepare_fixture,
                group,
            )

            future_map[future] = item

        completed = 0

        for future in as_completed(future_map):

            item = future_map[future]

            group = item["group"]

            try:
                result = future.result()

            except Exception as exc:

                completed += 1

                print(
                    f"[{completed}/"
                    f"{len(matched_fixtures)}] "
                    f"{group['event_name']} "
                    f"worker error: "
                    f"{exc}"
                )

                continue

            completed += 1

            if result["error"]:

                print(
                    f"[{completed}/"
                    f"{len(matched_fixtures)}] "
                    f"{group['event_name']} "
                    f"snapshot error: "
                    f"{result['error']}"
                )

                continue

            fixture_odds[group["event_name"]] = result["best_back_odds"]

            print(
                f"[{completed}/"
                f"{len(matched_fixtures)}] "
                f"{group['event_name']} "
                f"odds ready"
            )

    # ==================================================
    # 5. PREPARE BETFAIR MATCH_ODDS MARKETS
    # ==================================================

    print()

    print("Preparing Betfair " "MATCH_ODDS markets...")

    prepared_fixtures = []

    for item in matched_fixtures:

        group = item["group"]

        matched_event = item["betfair_event"]

        event_name = group["event_name"]

        best_back_odds = fixture_odds.get(
            event_name,
            {},
        )

        if not best_back_odds:
            continue

        try:
            markets = betfair.get_match_odds_market(matched_event.event.id)

            if not markets:

                print(
                    "No MATCH_ODDS market for",
                    event_name,
                )

                continue

            market = markets[0]

            prepared_fixtures.append(
                {
                    "group": group,
                    "betfair_event": matched_event,
                    "market": market,
                    "best_back_odds": best_back_odds,
                }
            )

        except Exception as exc:

            print(
                "Market catalogue error for",
                event_name,
                ":",
                exc,
            )

    print(f"Prepared " f"{len(prepared_fixtures)} " f"Betfair markets.")

    # ==================================================
    # 6. BATCH FETCH BETFAIR MARKET BOOKS
    # ==================================================

    market_ids = [item["market"].market_id for item in prepared_fixtures]

    print(f"Fetching " f"{len(market_ids)} " f"Betfair market books " f"in batches...")

    try:
        market_book_map = betfair.build_market_book_map(
            market_ids,
            batch_size=20,
        )

    except Exception as exc:

        print(
            "Failed to fetch " "Betfair market books:",
            exc,
        )

        market_book_map = {}

    # ==================================================
    # 7. CHECK ARBITRAGE
    # ==================================================

    print()

    print("Checking arbitrage opportunities...")

    for item in prepared_fixtures:

        group = item["group"]

        event_name = group["event_name"]

        matched_event = item["betfair_event"]

        market = item["market"]

        best_back_odds = item["best_back_odds"]

        # ----------------------------------------------
        # IMPORTANT:
        # Match market book by market_id.
        #
        # Never use list position because Betfair
        # batch response ordering may differ.
        # ----------------------------------------------

        market_book = market_book_map.get(str(market.market_id))

        if market_book is None:

            # Some implementations may use
            # the raw market_id as the key.

            market_book = market_book_map.get(market.market_id)

        if market_book is None:

            print(
                "No Betfair market book for",
                event_name,
            )

            continue

        print()

        print("-" * 60)

        print(
            "Odds fixture:",
            event_name,
        )

        print(
            "League:",
            group.get(
                "league",
                "",
            ),
        )

        print(
            "Matched Betfair:",
            matched_event.event.name,
        )

        # ==================================================
        # 8. SELECTION / RUNNER MATCHING
        # ==================================================

        for (
            selection_name,
            back_info,
        ) in best_back_odds.items():

            matched_runner = MatcherService.find_matching_runner(
                selection_name,
                market.runners,
                threshold=STRICT_RUNNER_MATCH_THRESHOLD,
                debug=debug_matching,
            )

            if not matched_runner:

                if debug_matching:

                    print(
                        "Rejected runner:",
                        selection_name,
                    )

                continue

            lay_odds = betfair.get_lay_price_for_selection(
                market.market_id,
                matched_runner.selection_id,
                market_book=market_book,
            )

            print(
                f"{selection_name} | "
                f"Back: "
                f"{back_info['odds']} "
                f"({back_info['bookmaker']}) | "
                f"Lay: {lay_odds}"
            )

            if lay_odds is None:
                continue

            # ==================================================
            # 9. ARBITRAGE CALCULATION
            # ==================================================

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

            result["start_time"] = group.get("start_time")

            result["sport"] = sport
            result["league"] = group.get(
                "league",
                "",
            )
            if result["profit_percentage"] < min_profit_pct:

                continue

            # ==================================================
            # 10. EXTRA SAFETY FOR LARGE ARBS
            # ==================================================

            profit_pct = result["profit_percentage"]

            # Large discrepancies are suspicious.
            # Keep them visible in logs so they can
            # be verified before execution.

            if profit_pct >= 5:

                print("!!! HIGH ARB - VERIFY !!!")

                print(
                    "Odds fixture:",
                    event_name,
                )

                print(
                    "Betfair fixture:",
                    matched_event.event.name,
                )

                print(
                    "Selection:",
                    selection_name,
                )

                print(
                    "Betfair runner:",
                    matched_runner.runner_name,
                )

                print(
                    "Back:",
                    back_info["odds"],
                    back_info["bookmaker"],
                )

                print(
                    "Lay:",
                    lay_odds,
                )

            opportunities.append(result)

            print(
                "[ARB] "
                f"{selection_name} | "
                f"{profit_pct:.2f}% | "
                f"${result['guaranteed_profit']:.2f}"
            )

    # ==================================================
    # 11. SORT RESULTS
    # ==================================================

    opportunities.sort(
        key=lambda item: item["profit_percentage"],
        reverse=True,
    )

    # ==================================================
    # 12. SUMMARY
    # ==================================================

    print()

    print("=" * 60)

    print(
        "Fixtures scanned:",
        len(grouped_events),
    )

    print(
        "Betfair matches:",
        matched_events_count,
    )

    print(
        "Arbitrage opportunities:",
        len(opportunities),
    )

    print("=" * 60)

    return {
        "sport": sport,
        "sport_name": sport_name,
        "scanned_events": len(grouped_events),
        "matched_events": matched_events_count,
        "count": len(opportunities),
        "opportunities": opportunities,
    }
