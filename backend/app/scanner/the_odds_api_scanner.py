from datetime import (
    datetime,
    timedelta,
    timezone,
)

from app.services.the_odds_api_service import (
    get_odds,
    get_sports,
)

SPORT_GROUP_NAMES = {
    "american football": "American Football",
    "aussie rules": "Aussie Rules",
    "baseball": "Baseball",
    "basketball": "Basketball",
    "boxing": "Boxing",
    "cricket": "Cricket",
    "golf": "Golf",
    "handball": "Handball",
    "ice hockey": "Ice Hockey",
    "lacrosse": "Lacrosse",
    "mixed martial arts": "Mixed Martial Arts",
    "rugby league": "Rugby League",
    "soccer": "Soccer",
    "tennis": "Tennis",
}

_sports_cache = {"data": None, "fetched_at": 0}
SPORTS_CACHE_TTL_SECONDS = 24 * 60 * 60


def _get_all_sports_cached():
    import time

    now = time.time()

    if (
        _sports_cache["data"] is None
        or now - _sports_cache["fetched_at"] > SPORTS_CACHE_TTL_SECONDS
    ):
        _sports_cache["data"] = get_sports()
        _sports_cache["fetched_at"] = now

    return _sports_cache["data"]


def get_active_keys_for_sport(sport: str) -> list[str]:
    group_name = SPORT_GROUP_NAMES.get(sport)

    if not group_name:
        return []

    all_sports = _get_all_sports_cached()

    return [
        s["key"] for s in all_sports if s.get("group") == group_name and s.get("active")
    ]


# --------------------------------------------------
# BACK-COMPAT: arbitrage_scanner.py currently imports
# SPORT_KEYS and indexes it directly at module load
# time to build SPORT_CONFIG. This keeps that import
# from breaking. It is a SNAPSHOT taken once at import
# -- see the note below about making this properly
# dynamic per-scan instead.
# --------------------------------------------------

SPORT_KEYS = {sport: get_active_keys_for_sport(sport) for sport in SPORT_GROUP_NAMES}


def normalize_event(
    event: dict,
    sport: str,
) -> dict:

    bookmakers = []

    for bookmaker in event.get("bookmakers", []):

        h2h_market = next(
            (
                market
                for market in bookmaker.get("markets", [])
                if market.get("key") == "h2h"
            ),
            None,
        )

        if not h2h_market:
            continue

        outcomes = [
            {
                "name": outcome.get("name"),
                "odds": outcome.get("price"),
            }
            for outcome in h2h_market.get("outcomes", [])
            if (outcome.get("name") is not None and outcome.get("price") is not None)
        ]

        if not outcomes:
            continue

        bookmakers.append(
            {
                "key": bookmaker.get("key"),
                "name": bookmaker.get("title"),
                "last_update": bookmaker.get("last_update"),
                "outcomes": outcomes,
            }
        )

    home_team = event.get("home_team")
    away_team = event.get("away_team")

    return {
        "event_id": event.get("id"),
        "sport": sport,
        "sport_key": event.get("sport_key"),
        "league": event.get("sport_title"),
        "home_team": home_team,
        "away_team": away_team,
        "event_name": f"{home_team} vs {away_team}",
        "start_time": event.get("commence_time"),
        "bookmakers": bookmakers,
    }


def scan_multi_sport(
    hours_ahead: int = 168,  # 7 days
    sports: list[str] | None = None,
):

    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=hours_ahead)

    commence_from = now.isoformat(timespec="seconds").replace("+00:00", "Z")

    commence_to = end_time.isoformat(timespec="seconds").replace("+00:00", "Z")

    selected_sports = sports if sports else list(SPORT_KEYS.keys())

    # Convert supplied category names to lowercase.
    selected_sports = [sport.strip().lower() for sport in selected_sports]

    invalid_sports = [sport for sport in selected_sports if sport not in SPORT_KEYS]

    if invalid_sports:
        raise ValueError(
            f"Unknown sports: {invalid_sports}. "
            f"Available sports: {list(SPORT_KEYS.keys())}"
        )

    all_events = []
    stats = {}

    for sport in selected_sports:

        sport_keys = get_active_keys_for_sport(sport)
        sport_events = []

        keys_attempted = 0
        keys_succeeded = 0
        keys_failed = 0
        keys_skipped = 0
        raw_events_found = 0

        for sport_key in sport_keys:

            # Your normalizer supports normal h2h events only.
            # Skip winner/outright keys to avoid wasting API credits.
            if sport_key.endswith("_winner"):
                keys_skipped += 1

                print(f"SKIPPED OUTRIGHT: {sport_key}")

                continue

            keys_attempted += 1

            print()
            print("=" * 60)
            print(f"ODDS API SCAN: " f"{sport.upper()} " f"[{sport_key}]")
            print("=" * 60)

            try:
                events = get_odds(
                    sport_key=sport_key,
                    commence_from=commence_from,
                    commence_to=commence_to,
                )

                # Protect against get_odds returning None.
                events = events or []

                keys_succeeded += 1
                raw_events_found += len(events)

                print(f"RETURNED: {len(events)} raw events")

            except Exception as exc:
                keys_failed += 1

                print(f"FAILED: {sport_key}: {exc!r}")

                continue

            usable_events = []

            for event in events:
                normalized_event = normalize_event(
                    event=event,
                    sport=sport,
                )

                if normalized_event["bookmakers"]:
                    usable_events.append(normalized_event)

            print(f"USABLE: {len(usable_events)} events " f"with h2h bookmaker odds")

            sport_events.extend(usable_events)

        stats[sport] = {
            "configured_keys": len(sport_keys),
            "keys_attempted": keys_attempted,
            "keys_succeeded": keys_succeeded,
            "keys_failed": keys_failed,
            "outright_keys_skipped": keys_skipped,
            "raw_events_found": raw_events_found,
            "usable_events": len(sport_events),
        }

        all_events.extend(sport_events)

    return {
        "count": len(all_events),
        "hours_ahead": hours_ahead,
        "commence_from": commence_from,
        "commence_to": commence_to,
        "sports": stats,
        "events": all_events,
    }
