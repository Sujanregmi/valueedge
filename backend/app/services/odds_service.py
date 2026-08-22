import os
from difflib import SequenceMatcher
import random
import time
import requests
from dotenv import load_dotenv

from app.services.matcher_service import MatcherService

load_dotenv()


API_KEY = os.getenv("ODDS_API_NET_KEY")

BASE_URL = "https://api.odds-api.net/v1"


AU_BOOKMAKERS = {
    "bet365",
    "betr",
    "betright",
    "dabble",
    "ladbrokes",
    "neds",
    "palmerbet",
    "picklebet",
    "playup",
    "pointsbet",
    "sportsbet",
    "tab",
    "tabtouch",
    "unibet",
}


def _headers():
    if not API_KEY:
        raise ValueError("ODDS_API_NET_KEY is missing from .env")

    return {
        "X-API-Key": API_KEY,
    }


def get_sport_events(
    sport: str,
    page_size: int = 100,
    max_events: int | None = None,
):
    """
    Fetch all events for one sport using
    Odds-API.net cursor pagination.

    max_events=None means:
    keep paging until next_cursor is empty.
    """

    all_events = []
    cursor = None
    page_number = 1

    while True:

        params = {
            "sport": sport,
            "limit": page_size,
        }

        if cursor:
            params["cursor"] = cursor

        print(f"Fetching {sport} events page " f"{page_number}...")

        max_retries = 5
        attempt = 0

        while True:

            response = requests.get(
                f"{BASE_URL}/events",
                headers=_headers(),
                params=params,
                timeout=60,
            )

            if response.status_code != 429:
                response.raise_for_status()
                break

            attempt += 1

            if attempt > max_retries:
                raise RuntimeError(
                    f"Odds-API.net rate limit "
                    f"persisted after "
                    f"{max_retries} retries"
                )

            retry_after = response.headers.get("Retry-After")

            if retry_after:
                wait_seconds = float(retry_after)

            else:
                wait_seconds = min(
                    2**attempt,
                    60,
                )

                wait_seconds += random.uniform(
                    0,
                    1,
                )

            print(
                f"Odds-API.net rate limited "
                f"({sport}). "
                f"Waiting "
                f"{wait_seconds:.1f}s..."
            )

            time.sleep(wait_seconds)

        # Successful response reached here
        data = response.json()

        events = data.get(
            "items",
            [],
        )

        if not isinstance(
            events,
            list,
        ):
            raise ValueError("Unexpected events response")

        all_events.extend(events)

        print(
            f"  Page {page_number}: "
            f"{len(events)} events "
            f"| Total: "
            f"{len(all_events)}"
        )

        if max_events is not None and len(all_events) >= max_events:
            return all_events[:max_events]

        cursor = data.get("next_cursor")

        if not cursor:
            break

        page_number += 1

    print(f"Finished. " f"Total {sport} events: " f"{len(all_events)}")

    return all_events


# ==================================================
# SOCCER COMPATIBILITY WRAPPER
# ==================================================


def get_soccer_events(
    page_size: int = 100,
    max_events: int | None = None,
):
    return get_sport_events(
        sport="soccer",
        page_size=page_size,
        max_events=max_events,
    )


def get_event_snapshot(
    event_id: str,
):
    """
    Fetch odds snapshot for one
    Odds-API.net event ID.
    """

    response = requests.get(
        (f"{BASE_URL}/events/" f"{event_id}/odds/snapshot"),
        headers=_headers(),
        timeout=60,
    )

    response.raise_for_status()

    return response.json()


def get_event_odds(
    event_id: str,
):
    """
    Return raw odds rows for one event.
    """

    data = get_event_snapshot(event_id)

    odds = data.get("items", [])

    if not isinstance(odds, list):
        return []

    return odds


def _team_similarity(
    name1: str,
    name2: str,
) -> float:
    """
    Compare two team names without
    hardcoding individual teams.
    """

    a = MatcherService.normalize(name1)
    b = MatcherService.normalize(name2)

    if a == b:
        return 1.0

    return SequenceMatcher(
        None,
        a,
        b,
    ).ratio()


def _same_fixture(
    event: dict,
    group: dict,
) -> bool:
    """
    Determine whether two API records
    represent the same real match.
    """

    start1 = int(event["start_time"])

    start2 = int(group["start_time"])

    # Kickoff must be within 5 minutes.

    if abs(start1 - start2) > 300:
        return False

    home_score = _team_similarity(
        event["home_team"],
        group["home_team"],
    )

    away_score = _team_similarity(
        event["away_team"],
        group["away_team"],
    )

    # Both team names are similar.
    if home_score >= 0.65 and away_score >= 0.65:
        return True

    # One team is almost identical,
    # while the other is abbreviated.
    if home_score >= 0.45 and away_score >= 0.95:
        return True

    if away_score >= 0.45 and home_score >= 0.95:
        return True

    return False


def group_duplicate_events(
    events: list[dict],
) -> list[dict]:
    """
    Merge duplicate Odds-API.net records
    for the same real-world match.
    """

    grouped = []

    for event in events:

        home = event.get("home_team")

        away = event.get("away_team")

        start_time = event.get("start_time")

        event_id = event.get("event_id")

        if not home or not away or start_time is None or event_id is None:
            continue

        matched_group = None

        for group in grouped:

            if _same_fixture(
                event,
                group,
            ):
                matched_group = group
                break

        if matched_group:

            event_id_str = str(event_id)

            if event_id_str not in matched_group["event_ids"]:
                matched_group["event_ids"].append(event_id_str)

            for bookmaker in event.get(
                "bookmakers",
                [],
            ):
                if bookmaker not in matched_group["bookmakers"]:
                    matched_group["bookmakers"].append(bookmaker)

        else:

            grouped.append(
                {
                    "event_name": f"{home} vs {away}",
                    "home_team": home,
                    "away_team": away,
                    "league": event.get("league"),
                    "start_time": int(start_time),
                    "event_ids": [str(event_id)],
                    "bookmakers": list(
                        event.get(
                            "bookmakers",
                            [],
                        )
                    ),
                }
            )

    return grouped


def get_best_back_odds_for_group(
    group: dict,
) -> dict:
    """
    Return the best full-time match-result
    bookmaker odds for HOME, AWAY and DRAW.

    Handles bookmaker naming differences such as:

    PSG
    Paris St-G
    Paris Saint-Germain
    1

    and:

    Draw
    X
    """

    best = {}

    home_team = group["home_team"]
    away_team = group["away_team"]

    for event_id in group["event_ids"]:

        snapshot = get_event_snapshot(event_id)

        rows = snapshot.get(
            "items",
            [],
        )

        for row in rows:

            bookmaker = (
                row.get(
                    "bookmaker",
                    "",
                )
                .lower()
                .strip()
            )

            if bookmaker not in AU_BOOKMAKERS:
                continue

            if not row.get(
                "is_available",
                False,
            ):
                continue

            period = (
                row.get(
                    "period",
                    "",
                )
                .lower()
                .strip()
            )

            if period != "full time":
                continue

            metric = (
                row.get(
                    "metric",
                    "",
                )
                .lower()
                .strip()
            )

            if metric != "standard":
                continue

            bet_type = (
                row.get(
                    "bet_type",
                    "",
                )
                .lower()
                .strip()
            )

            market_key = (
                row.get(
                    "market_key",
                    "",
                )
                .lower()
                .strip()
            )

            is_match_result = (
                bet_type
                in {
                    "moneyline",
                    "match winner",
                    "match result",
                    "h2h",
                }
                or "moneyline" in market_key
                or "match winner" in market_key
                or "match result" in market_key
            )

            if not is_match_result:
                continue

            raw_selection = row.get("selection_name")

            odds = row.get("odds")

            if not raw_selection or odds is None:
                continue

            try:
                odds = float(odds)
            except (
                TypeError,
                ValueError,
            ):
                continue

            if odds <= 1:
                continue

            selection_text = str(raw_selection).strip()

            selection_lower = selection_text.lower()

            # -------------------------
            # DRAW
            # -------------------------

            if selection_lower in {
                "draw",
                "x",
            }:
                canonical_selection = "Draw"

            # -------------------------
            # HOME
            # -------------------------

            elif selection_lower == "1":
                canonical_selection = home_team

            # -------------------------
            # AWAY
            # -------------------------

            elif selection_lower == "2":
                canonical_selection = away_team

            else:

                home_similarity = _team_similarity(
                    selection_text,
                    home_team,
                )

                away_similarity = _team_similarity(
                    selection_text,
                    away_team,
                )

                if home_similarity >= 0.45 and home_similarity > away_similarity:
                    canonical_selection = home_team

                elif away_similarity >= 0.45 and away_similarity > home_similarity:
                    canonical_selection = away_team

                else:
                    continue

            current = best.get(canonical_selection)

            if current is None or odds > current["odds"]:
                best[canonical_selection] = {
                    "odds": odds,
                    "bookmaker": bookmaker,
                    "event_id": str(event_id),
                    "original_selection": selection_text,
                }

    return best
