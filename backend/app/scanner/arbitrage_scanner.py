"""
EdgePulse Arbitrage Scanner

Pipeline:

Odds-API.net events
    ->
Group + de-duplicate fixtures
    ->
Strict fixture match to Betfair
    ->
Bookmaker BACK odds (from Odds API response)
    ->
Betfair market books in batches
    ->
Betfair LAY odds
    ->
Arbitrage Engine
"""

from datetime import datetime, timezone

from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService
from app.engine.arbitrage_engine import find_back_lay_arbitrage
from app.services.the_odds_api_service import get_odds

# ==================================================
# CONFIG
# ==================================================
#
# `odds_api_sport_key` is the sport_key The Odds API expects
# (see GET /v4/sports for the authoritative, always-current list).
# These are single "primary league" keys for a first pass — if you
# want multi-league coverage per sport (e.g. all soccer leagues,
# not just EPL), turn this into a list and loop over it in step 2.
#
# IMPORTANT: verify these against your Odds API account/plan before
# relying on them — some leagues are gated behind paid tiers.

SPORT_CONFIG = {
    "soccer": {
        "name": "Soccer",
        "betfair_event_type_id": "1",
        "odds_api_sport_key": "soccer_epl",
    },
    "tennis": {
        "name": "Tennis",
        "betfair_event_type_id": "2",
        "odds_api_sport_key": "tennis",
    },
    "basketball": {
        "name": "Basketball",
        "betfair_event_type_id": "7522",
        "odds_api_sport_key": "basketball_nba",
    },
    "ice hockey": {
        "name": "Ice Hockey",
        "betfair_event_type_id": "7524",
        "odds_api_sport_key": "icehockey_nhl",
    },
    "rugby league": {
        "name": "Rugby League",
        "betfair_event_type_id": "1477",
        "odds_api_sport_key": "rugbyleague_nrl",
    },
    "aussie rules": {
        "name": "Australian Rules",
        "betfair_event_type_id": "61420",
        "odds_api_sport_key": "aussierules_afl",
    },
    "baseball": {
        "name": "Baseball",
        "betfair_event_type_id": "7511",
        "odds_api_sport_key": "baseball_mlb",
    },
    "american football": {
        "name": "American Football",
        "betfair_event_type_id": "6423",
        "odds_api_sport_key": "americanfootball_nfl",
    },
}

MAX_SNAPSHOT_WORKERS = 6

STRICT_EVENT_MATCH_THRESHOLD = 0.82

STRICT_RUNNER_MATCH_THRESHOLD = 0.82

# --------------------------------------------------
# Exchanges to exclude from "bookmaker" BACK odds.
#
# The Odds API can include Betfair Exchange (and other
# exchanges) in its bookmakers list. Since our LAY side
# is already sourced directly from Betfair, letting an
# exchange win best_back_odds means we end up comparing
# Betfair's own back price against Betfair's own lay
# price on the same market -- that's just the exchange
# spread, never a real arb, and it will silently starve
# every other bookmaker out of best_back_odds because
# exchange prices are almost always the tightest.
# --------------------------------------------------

EXCLUDED_BOOKMAKERS = {
    "betfair",
    "betfair exchange",
    "matchbook",
    "smarkets",
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
    odds_api_sport_key = sport_config["odds_api_sport_key"]

    print("=" * 60)
    print(f"EDGEPULSE ARBITRAGE SCANNER - {sport_name}")
    print("=" * 60)

    # ==================================================
    # 1. BETFAIR EVENTS
    # ==================================================

    betfair = BetfairService()

    print(f"Logging into Betfair for {sport_name}...")

    try:
        betfair.login()
        betfair_events = betfair.get_events(betfair_event_type_id)
    except Exception as exc:
        print(f"Failed to fetch Betfair {sport_name} events:", exc)
        return {
            "sport": sport,
            "sport_name": sport_name,
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
        }

    print(f"Betfair returned {len(betfair_events)} {sport_name} events.\n")

    # ==================================================
    # 2. THE ODDS API EVENTS + BOOKMAKER ODDS
    # ==================================================

    print(f"Fetching The Odds API {sport_name} events ({odds_api_sport_key})...")

    try:
        raw_events = get_odds(sport_key=odds_api_sport_key)
    except Exception as exc:
        print("Failed to fetch The Odds API events:", exc)
        return {
            "sport": sport,
            "sport_name": sport_name,
            "scanned_events": 0,
            "matched_events": 0,
            "count": 0,
            "opportunities": [],
        }

    if event_limit is not None:
        raw_events = raw_events[:event_limit]

    # --------------------------------------------------
    # Group + de-duplicate.
    #
    # The Odds API can occasionally return the same fixture
    # more than once (e.g. across paginated/partial responses).
    # Key on (home_team, away_team, commence_time) so duplicates
    # collapse into a single grouped fixture instead of producing
    # duplicate arb opportunities downstream.
    # --------------------------------------------------

    grouped_by_key = {}

    for event in raw_events:
        home_team = event.get("home_team", "")
        away_team = event.get("away_team", "")
        commence_time = event.get("commence_time")

        if not home_team or not away_team:
            continue

        dedup_key = (home_team, away_team, commence_time)

        # --------------------------------------
        # Convert ISO start time to timestamp
        # because MatcherService expects
        # start_time in this format.
        # --------------------------------------

        start_time = None

        if commence_time:
            try:
                start_dt = datetime.fromisoformat(commence_time.replace("Z", "+00:00"))
                start_time = start_dt.timestamp()
            except Exception:
                start_time = None

        # --------------------------------------
        # Extract best BACK price for each
        # selection from all bookmakers.
        # --------------------------------------

        best_back_odds = {}

        for bookmaker in event.get("bookmakers", []):
            bookmaker_name = bookmaker.get("title", "")

            if bookmaker_name.strip().lower() in EXCLUDED_BOOKMAKERS:
                continue

            for market in bookmaker.get("markets", []):
                if market.get("key") != "h2h":
                    continue

                for outcome in market.get("outcomes", []):
                    selection = outcome.get("name")
                    odds = outcome.get("price")

                    if not selection or odds is None:
                        continue

                    current = best_back_odds.get(selection)

                    if current is None or odds > current["odds"]:
                        best_back_odds[selection] = {
                            "odds": odds,
                            "bookmaker": bookmaker_name,
                        }

        existing = grouped_by_key.get(dedup_key)

        if existing is None:
            grouped_by_key[dedup_key] = {
                "event_name": f"{home_team} vs {away_team}",
                "home_team": home_team,
                "away_team": away_team,
                "league": event.get("sport_title", ""),
                "start_time": start_time,
                "best_back_odds": best_back_odds,
                "odds_api_event_id": event.get("id"),
            }
        else:
            # Duplicate fixture seen again — merge in any better
            # BACK odds instead of just dropping the second copy.
            for selection, info in best_back_odds.items():
                current = existing["best_back_odds"].get(selection)
                if current is None or info["odds"] > current["odds"]:
                    existing["best_back_odds"][selection] = info

    grouped_events = list(grouped_by_key.values())

    print(f"The Odds API returned {len(raw_events)} events.")
    print(f"Prepared {len(grouped_events)} de-duplicated {sport_name} fixtures.\n")

    # ==================================================
    # 3. STRICT FIXTURE MATCHING
    # ==================================================

    matched_fixtures = []

    for group in grouped_events:
        event_name = group.get("event_name", "")
        league = group.get("league", "")
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
                print("REJECTED:", event_name)
            continue

        matched_events_count += 1

        matched_fixtures.append(
            {
                "group": group,
                "betfair_event": matched_event,
            }
        )

    print(f"Matched {len(matched_fixtures)} verified {sport} fixtures to Betfair.")

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
    # 4. USE BOOKMAKER BACK ODDS FROM ODDS API RESPONSE
    # ==================================================

    print()
    print("Preparing bookmaker BACK odds from The Odds API response...")

    fixture_odds = {}

    for item in matched_fixtures:
        group = item["group"]
        event_name = group.get("event_name", "")
        best_back_odds = group.get("best_back_odds", {})

        if not best_back_odds:
            print("No bookmaker BACK odds for", event_name)
            continue

        fixture_odds[event_name] = best_back_odds
        print(event_name, "| bookmaker odds ready")

    print(f"Prepared bookmaker odds for {len(fixture_odds)} fixtures.")

    # ==================================================
    # 5. PREPARE BETFAIR MATCH_ODDS MARKETS
    # ==================================================

    print()
    print("Preparing Betfair MATCH_ODDS markets...")

    prepared_fixtures = []

    for item in matched_fixtures:
        group = item["group"]
        matched_event = item["betfair_event"]
        event_name = group["event_name"]

        best_back_odds = fixture_odds.get(event_name, {})

        if not best_back_odds:
            continue

        try:
            markets = betfair.get_match_odds_market(matched_event.event.id)

            if not markets:
                print("No MATCH_ODDS market for", event_name)
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
            print("Market catalogue error for", event_name, ":", exc)

    print(f"Prepared {len(prepared_fixtures)} Betfair markets.")

    # ==================================================
    # 6. BATCH FETCH BETFAIR MARKET BOOKS
    # ==================================================

    market_ids = [item["market"].market_id for item in prepared_fixtures]

    print(f"Fetching {len(market_ids)} Betfair market books in batches...")

    try:
        market_book_map = betfair.build_market_book_map(market_ids, batch_size=20)
    except Exception as exc:
        print("Failed to fetch Betfair market books:", exc)
        market_book_map = {}

    def _lookup_market_book(market_id):
        """
        Betfair batch responses may key the map by either the raw
        market_id or its string form depending on the implementation
        of build_market_book_map. Check both explicitly rather than
        relying on accidental type coercion.
        """
        if market_id in market_book_map:
            return market_book_map[market_id]
        return market_book_map.get(str(market_id))

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

        market_book = _lookup_market_book(market.market_id)

        if market_book is None:
            print("No Betfair market book for", event_name)
            continue

        print()
        print("-" * 60)
        print("Odds fixture:", event_name)
        print("League:", group.get("league", ""))
        print("Matched Betfair:", matched_event.event.name)

        # ==================================================
        # 8. SELECTION / RUNNER MATCHING
        # ==================================================

        for selection_name, back_info in best_back_odds.items():
            matched_runner = MatcherService.find_matching_runner(
                selection_name,
                market.runners,
                threshold=STRICT_RUNNER_MATCH_THRESHOLD,
                debug=debug_matching,
            )

            if not matched_runner:
                if debug_matching:
                    print("Rejected runner:", selection_name)
                continue

            lay_odds = betfair.get_lay_price_for_selection(
                market.market_id,
                matched_runner.selection_id,
                market_book=market_book,
            )

            print(
                f"{selection_name} | "
                f"Back: {back_info['odds']} ({back_info['bookmaker']}) | "
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
            result["league"] = group.get("league", "")

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
                print("Odds fixture:", event_name)
                print("Betfair fixture:", matched_event.event.name)
                print("Selection:", selection_name)
                print("Betfair runner:", matched_runner.runner_name)
                print("Back:", back_info["odds"], back_info["bookmaker"])
                print("Lay:", lay_odds)

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

    opportunities.sort(key=lambda item: item["profit_percentage"], reverse=True)

    # ==================================================
    # 12. SUMMARY
    # ==================================================

    print()
    print("=" * 60)
    print("Fixtures scanned:", len(grouped_events))
    print("Betfair matches:", matched_events_count)
    print("Arbitrage opportunities:", len(opportunities))
    print("=" * 60)

    return {
        "sport": sport,
        "sport_name": sport_name,
        "scanned_events": len(grouped_events),
        "matched_events": matched_events_count,
        "count": len(opportunities),
        "opportunities": opportunities,
    }