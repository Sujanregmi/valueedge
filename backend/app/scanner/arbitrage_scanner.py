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
from app.engine.cross_book_engine import find_cross_book_arbitrage
from app.services.the_odds_api_service import get_odds, get_all_sport_keys

# ==================================================
# CONFIG
# ==================================================
#
# `odds_api_sport_keys` is a LIST of sport_key values The Odds API
# expects (see GET /v4/sports for the authoritative, always-current
# list -- that endpoint costs zero quota, use it to verify any key
# you're unsure about before relying on it).
#
# Soccer covers multiple leagues since one league (EPL) misses most
# of the world's fixtures. Every key below except "soccer_epl" and
# "soccer_germany_bundesliga" is my best-confidence guess based on
# The Odds API's naming pattern (soccer_{country}_{league}) -- run
# check_sport_keys.py (below) to confirm/correct these against the
# real API before trusting them blindly. A wrong key here just means
# that league silently returns 0 events for this sport, not a crash
# -- see the per-key try/except in step 2.
#
# IMPORTANT: verify these against your Odds API account/plan too --
# some leagues are gated behind paid tiers.


SPORT_CONFIG = {
    "soccer": {
        "name": "Soccer",
        "betfair_event_type_id": "1",
        "odds_api_prefix": "soccer_",
    },
    "tennis": {
        "name": "Tennis",
        "betfair_event_type_id": "2",
        "odds_api_prefix": "tennis_",
    },
    "basketball": {
        "name": "Basketball",
        "betfair_event_type_id": "7522",
        "odds_api_prefix": "basketball_",
    },
    "ice hockey": {
        "name": "Ice Hockey",
        "betfair_event_type_id": "7524",
        "odds_api_prefix": "icehockey_",
    },
    "rugby league": {
        "name": "Rugby League",
        "betfair_event_type_id": "1477",
        "odds_api_prefix": "rugbyleague_",
    },
    "aussie rules": {
        "name": "Australian Rules",
        "betfair_event_type_id": "61420",
        "odds_api_prefix": "aussierules_",
    },
    "baseball": {
        "name": "Baseball",
        "betfair_event_type_id": "7511",
        "odds_api_prefix": "baseball_",
    },
    "american football": {
        "name": "American Football",
        "betfair_event_type_id": "6423",
        "odds_api_prefix": "americanfootball_",
    },
}

MAX_SNAPSHOT_WORKERS = 6

STRICT_EVENT_MATCH_THRESHOLD = 0.82

# How far ahead (days) it's worth attempting Betfair matching at
# all. Unverified guess -- override per sport via
# SPORT_CONFIG[sport]["max_days_ahead"], e.g. if you observe NFL
# markets open earlier/later than 21 days, add
# "max_days_ahead": 14 to that sport's config entry.
DEFAULT_MAX_DAYS_AHEAD = 21

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

    # Resolve the actual league keys to fetch. If odds_api_prefix is
    # set, discover every currently in-season league matching that
    # prefix (e.g. every "soccer_*" league) rather than using a fixed
    # list -- see get_all_sport_keys() for the quota implications.
    odds_api_prefix = sport_config["odds_api_prefix"]

    odds_api_sport_keys = get_all_sport_keys(prefix=odds_api_prefix)

    print(
        f"Discovered {len(odds_api_sport_keys)} active " f"{sport_name} competitions:"
    )

    for key in odds_api_sport_keys:
        print(f"  - {key}")

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
    #
    # Fetches every configured league for this sport and merges the
    # results. A single league's fetch failing (wrong key, that
    # league gated behind a higher plan tier, temporary API issue)
    # only drops that league's events -- it does NOT abort the whole
    # sport, matching the defensive per-item error handling used
    # everywhere else in this file.

    raw_events = []

    for league_key in odds_api_sport_keys:
        print(f"Fetching The Odds API {sport_name} events ({league_key})...")

        try:
            league_events = get_odds(sport_key=league_key)
            raw_events.extend(league_events)
        except Exception as exc:
            print(f"Failed to fetch {league_key}:", exc)
            continue

    if not raw_events:
        print(f"No events returned for any {sport_name} league.")
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

            # The Odds API may provide a bookmaker-level event link.
            bookmaker_link = bookmaker.get("link")

            for market in bookmaker.get("markets", []):
                if market.get("key") != "h2h":
                    continue

                # Some bookmakers may provide a more specific market link.
                market_link = market.get("link")

                for outcome in market.get("outcomes", []):
                    selection = outcome.get("name")
                    odds = outcome.get("price")

                    if not selection or odds is None:
                        continue

                    # Prefer the deepest / most specific link available:
                    # outcome -> market -> bookmaker/event.
                    outcome_link = outcome.get("link")

                    bet_link = outcome_link or market_link or bookmaker_link

                    current = best_back_odds.get(selection)

                    if current is None or odds > current["odds"]:
                        best_back_odds[selection] = {
                            "odds": odds,
                            "bookmaker": bookmaker_name,
                            "link": bet_link,
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

        # ------------------------------------------
        # CROSS-BOOK ARBITRAGE (no Betfair needed)
        #
        # Runs independently of Betfair matching below -- checks
        # this event's own best_back_odds (already built in step 2)
        # for a surebet across different bookmakers on the same
        # event. Catches opportunities even on events Betfair
        # doesn't list at all, since it never touches betfair_events.
        #
        # Wrapped defensively: a bad event here (malformed odds,
        # unexpected data shape) must NEVER abort the rest of this
        # function -- back-lay detection below still has to run
        # regardless of what happens in this block.
        # ------------------------------------------

        try:
            cross_book_result = find_cross_book_arbitrage(
                event=event_name,
                best_back_odds=group.get("best_back_odds", {}),
                total_stake=bookmaker_stake,
                min_profit_pct=min_profit_pct,
            )
        except Exception as exc:
            print("Cross-book check failed for", event_name, ":", exc)
            cross_book_result = None

        if cross_book_result:
            cross_book_result["start_time"] = start_time
            cross_book_result["sport"] = sport
            cross_book_result["league"] = league

            opportunities.append(cross_book_result)

            print(
                "[CROSS-BOOK ARB] "
                f"{event_name} | "
                f"{cross_book_result['profit_percentage']:.2f}% | "
                f"${cross_book_result['guaranteed_profit']:.2f} | "
                f"{len(cross_book_result['legs'])}-way"
            )

        # ------------------------------------------
        # SKIP BETFAIR MATCHING FOR FAR-FUTURE EVENTS
        #
        # Betfair typically only opens MATCH_ODDS markets some
        # window ahead of kickoff -- attempting to match an event
        # months out just burns processing time comparing it against
        # every currently-listed Betfair fixture, none of which can
        # possibly be it. Skipping here does NOT affect cross-book
        # detection above, which already ran and doesn't need
        # Betfair at all.
        #
        # DAYS_AHEAD_LIMIT is a guess (21 days), not measured against
        # real Betfair listing behavior per sport -- tune per-sport
        # via SPORT_CONFIG[sport]["max_days_ahead"] once you've
        # observed how far out markets actually open (e.g. by
        # checking how many days ahead your genuinely-matched
        # fixtures tend to be).
        # ------------------------------------------

        if start_time:
            days_ahead = (
                float(start_time) - datetime.now(timezone.utc).timestamp()
            ) / 86400

            max_days_ahead = sport_config.get("max_days_ahead", DEFAULT_MAX_DAYS_AHEAD)

            if days_ahead > max_days_ahead:
                if debug_matching:
                    print(f"SKIP (too far ahead, {days_ahead:.0f}d): " f"{event_name}")
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

            # Deep link returned by The Odds API.
            result["bookmaker_link"] = back_info.get("link")

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
