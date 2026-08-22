from datetime import (
    datetime,
    timedelta,
    timezone,
)

from app.services.the_odds_api_service import (
    get_odds,
)


SPORT_KEYS = {
    "soccer": [
        "soccer_epl",
        "soccer_spain_la_liga",
        "soccer_italy_serie_a",
        "soccer_germany_bundesliga",
        "soccer_france_ligue_one",
        "soccer_usa_mls",
    ],

    "tennis": [
        "tennis_atp_cincinnati_open",
        "tennis_wta_cincinnati_open",
    ],

    "basketball": [
        "basketball_nba",
        "basketball_wnba",
    ],

    "ice hockey": [
        "icehockey_nhl",
    ],

    "rugby league": [
        "rugbyleague_nrl",
        "rugbyleague_nrlw",
    ],

    "aussie rules": [
        "aussierules_afl",
        "aussierules_aflw",
    ],

    "baseball": [
        "baseball_mlb",
    ],

    "american football": [
        "americanfootball_nfl",
        "americanfootball_nfl_preseason",
    ],
}


def normalize_event(
    event: dict,
    sport: str,
) -> dict:

    bookmakers = []

    for bookmaker in event.get(
        "bookmakers",
        [],
    ):

        h2h_market = None

        for market in bookmaker.get(
            "markets",
            [],
        ):

            if market.get("key") == "h2h":
                h2h_market = market
                break

        if not h2h_market:
            continue

        outcomes = []

        for outcome in h2h_market.get(
            "outcomes",
            [],
        ):

            outcomes.append(
                {
                    "name":
                        outcome.get("name"),

                    "odds":
                        outcome.get("price"),
                }
            )

        if not outcomes:
            continue

        bookmakers.append(
            {
                "key":
                    bookmaker.get("key"),

                "name":
                    bookmaker.get("title"),

                "last_update":
                    bookmaker.get(
                        "last_update"
                    ),

                "outcomes":
                    outcomes,
            }
        )

    return {
        "event_id":
            event.get("id"),

        "sport":
            sport,

        "sport_key":
            event.get("sport_key"),

        "league":
            event.get("sport_title"),

        "home_team":
            event.get("home_team"),

        "away_team":
            event.get("away_team"),

        "event_name":
            (
                f"{event.get('home_team')} "
                f"vs "
                f"{event.get('away_team')}"
            ),

        "start_time":
            event.get("commence_time"),

        "bookmakers":
            bookmakers,
    }

def scan_multi_sport(
    hours_ahead: int = 48,
    sports: list[str] | None = None,
):

    now = datetime.now(
        timezone.utc
    )

    end_time = (
        now
        + timedelta(
            hours=hours_ahead
        )
    )

    commence_from = (
        now.isoformat()
        .replace("+00:00", "Z")
    )

    commence_to = (
        end_time.isoformat()
        .replace("+00:00", "Z")
    )

    selected_sports = (
        sports
        if sports
        else list(
            SPORT_KEYS.keys()
        )
    )

    all_events = []

    stats = {}


    for sport in selected_sports:

        sport_keys = SPORT_KEYS.get(
            sport,
            [],
        )

        sport_events = []


        for sport_key in sport_keys:

            print()
            print(
                "=" * 60
            )

            print(
                f"ODDS API SCAN: "
                f"{sport.upper()} "
                f"[{sport_key}]"
            )

            print(
                "=" * 60
            )


            try:

                events = get_odds(
                    sport_key=
                        sport_key,

                    commence_from=
                        commence_from,

                    commence_to=
                        commence_to,
                )

            except Exception as exc:

                print(
                    "FAILED:",
                    sport_key,
                    repr(exc),
                )

                continue


            normalized = [
                normalize_event(
                    event,
                    sport,
                )
                for event in events
            ]


            sport_events.extend(
                normalized
            )


        stats[sport] = len(
            sport_events
        )

        all_events.extend(
            sport_events
        )


    return {
        "count":
            len(all_events),

        "sports":
            stats,

        "events":
            all_events,
    }
