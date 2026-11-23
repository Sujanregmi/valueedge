"""
One-off discovery script.

Run this manually (NOT on a schedule, NOT inside the scanner) to find
out, for a given list of The Odds API sport keys, which markets and
which AU bookmakers actually return data.

This costs real API credits -- each market you test costs quota,
multiplied by how many regions you test. Keep SPORT_KEYS_TO_CHECK and
CANDIDATE_MARKETS small and deliberate; don't run this against every
sport The Odds API offers.

Usage:
    python discover_markets.py
"""

from app.services.the_odds_api_service import get_odds


# --------------------------------------------------
# EDIT THESE TWO LISTS BEFORE RUNNING
# --------------------------------------------------

# The exact odds-api sport keys you currently scan.
# Pull these from your existing SPORT_KEYS config -- e.g.
# "soccer_epl", "aussierules_afl", "aussierules_aflw",
# "basketball_nba", "tennis_atp_us_open", etc.
SPORT_KEYS_TO_CHECK = [
    "aussierules_afl",
    "aussierules_aflw",
    # add more sport keys here
]

# Markets to test. The-odds-api accepts a comma-separated list in
# ONE call -- it just omits whatever it doesn't have, it does not
# error on unsupported markets, so this is safe to request together.
CANDIDATE_MARKETS = "h2h,totals,spreads,btts"


def discover_sport(sport_key: str):
    print()
    print("=" * 60)
    print(f"SPORT KEY: {sport_key}")
    print("=" * 60)

    try:
        events = get_odds(
            sport_key=sport_key,
            markets=CANDIDATE_MARKETS,
        )
    except Exception as exc:
        print(f"FAILED to fetch {sport_key}:", repr(exc))
        return

    if not events:
        print("No events returned (sport may be out of season).")
        return

    market_keys_seen = set()
    bookmakers_seen = set()
    market_sample_counts = {}

    for event in events:
        for bookmaker in event.get("bookmakers", []):
            bookmakers_seen.add(bookmaker.get("title", bookmaker.get("key", "?")))

            for market in bookmaker.get("markets", []):
                market_key = market.get("key")
                market_keys_seen.add(market_key)

                outcomes = market.get("outcomes", [])
                market_sample_counts[market_key] = (
                    market_sample_counts.get(market_key, 0) + len(outcomes)
                )

    print(f"Events returned: {len(events)}")
    print(f"Market keys found: {sorted(market_keys_seen) or 'NONE'}")

    for market_key, outcome_count in sorted(market_sample_counts.items()):
        print(f"  - {market_key}: {outcome_count} total outcomes across all events")

    print(f"Bookmakers seen ({len(bookmakers_seen)}): {sorted(bookmakers_seen)}")

    # Show a concrete example of what a totals/spreads outcome
    # actually looks like, if present -- useful for confirming line
    # values and naming before wiring it into the scanner.
    for market_key in ("totals", "spreads", "btts"):
        if market_key not in market_keys_seen:
            continue

        for event in events:
            for bookmaker in event.get("bookmakers", []):
                for market in bookmaker.get("markets", []):
                    if market.get("key") == market_key:
                        print(f"\n  Sample '{market_key}' market ({bookmaker.get('title')}):")
                        print(f"    {market.get('outcomes')}")
                        break
                else:
                    continue
                break
            else:
                continue
            break


if __name__ == "__main__":
    for sport_key in SPORT_KEYS_TO_CHECK:
        discover_sport(sport_key)

    print()
    print("=" * 60)
    print("DONE. Update SPORT_CONFIG / market defaults based on")
    print("what actually came back above.")
    print("=" * 60)