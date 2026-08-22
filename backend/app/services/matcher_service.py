import re
import unicodedata

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from rapidfuzz import fuzz


AUSTRALIA_TZ = ZoneInfo(
    "Australia/Sydney"
)


class MatcherService:

    # ==================================================
    # SPORT CONFIG
    # ==================================================

    SPORT_CONFIG = {
        # Home / away order matters
        "soccer": {
            "order_sensitive": True,
        },
        "football": {
            "order_sensitive": True,
        },
        "basketball": {
            "order_sensitive": True,
        },
        "nba": {
            "order_sensitive": True,
        },
        "afl": {
            "order_sensitive": True,
        },
        "nrl": {
            "order_sensitive": True,
        },
        "rugby": {
            "order_sensitive": True,
        },
        "baseball": {
            "order_sensitive": True,
        },
        "hockey": {
            "order_sensitive": True,
        },

        # Player order may differ between providers
        "tennis": {
            "order_sensitive": False,
        },
        "mma": {
            "order_sensitive": False,
        },
        "ufc": {
            "order_sensitive": False,
        },
        "boxing": {
            "order_sensitive": False,
        },
    }


    # ==================================================
    # NORMALIZATION
    # ==================================================

    @staticmethod
    def normalize(text: str | None) -> str:
        """
        Normalize participant, event and league names.
        """

        if not text:
            return ""

        text = (
            unicodedata
            .normalize(
                "NFKD",
                text,
            )
            .encode(
                "ascii",
                "ignore",
            )
            .decode("ascii")
        )

        text = text.lower()

        # Normalize event separators
        text = re.sub(
            r"\s+v\s+",
            " vs ",
            text,
        )

        text = re.sub(
            r"\s+@\s+",
            " vs ",
            text,
        )

        text = re.sub(
            r"\s+versus\s+",
            " vs ",
            text,
        )

        # Remove punctuation
        text = re.sub(
            r"[^a-z0-9 ]",
            " ",
            text,
        )

        text = re.sub(
            r"\s+",
            " ",
            text,
        ).strip()

        if text.startswith("the "):
            text = text[4:]

        return text


    # ==================================================
    # TEAM / PARTICIPANT ALIASES
    # ==================================================
    #
    # token_set_ratio scores near 100 when one name's
    # tokens are a full subset of the other's (e.g.
    # "hull" vs "hull city", "ipswich" vs "ipswich town")
    # -- no alias needed for those.
    #
    # It scores POORLY when providers use genuinely
    # different words for the same club (e.g. Betfair's
    # "Man Utd" vs Odds API's "Manchester United" share
    # zero tokens in common: "man" != "manchester" and
    # "utd" != "united"). Those need an explicit alias
    # mapping both variants to one canonical string, or
    # they'll silently fall below threshold and get
    # rejected as "participants" mismatches.
    #
    # Add new entries here whenever a REJECT log line
    # shows a same-club pair scoring low despite being
    # an obvious human-readable match.

    TEAM_ALIASES = {
        "psg":
            "paris saint germain",

        "paris st g":
            "paris saint germain",

        "paris st germain":
            "paris saint germain",

        "paris saint germain":
            "paris saint germain",

        "atletico mg":
            "atletico mineiro",

        "atletico mineiro":
            "atletico mineiro",

        "se palmeiras":
            "palmeiras",

        # --------------------------------------------
        # EPL / English football abbreviations
        # --------------------------------------------

        "man utd":
            "manchester united",

        "man u":
            "manchester united",

        "manchester utd":
            "manchester united",

        "manchester united":
            "manchester united",

        "man city":
            "manchester city",

        "manchester city":
            "manchester city",

        "spurs":
            "tottenham hotspur",

        "tottenham":
            "tottenham hotspur",

        "tottenham hotspur":
            "tottenham hotspur",

        "wolves":
            "wolverhampton wanderers",

        "wolverhampton":
            "wolverhampton wanderers",

        "wolverhampton wanderers":
            "wolverhampton wanderers",

        "newcastle utd":
            "newcastle united",

        "newcastle united":
            "newcastle united",

        "west ham":
            "west ham united",

        "west ham utd":
            "west ham united",

        "west ham united":
            "west ham united",

        "leeds utd":
            "leeds united",

        "leeds united":
            "leeds united",

        "nottm forest":
            "nottingham forest",

        "notts forest":
            "nottingham forest",

        "nottingham forest":
            "nottingham forest",

        "sheff utd":
            "sheffield united",

        "sheffield utd":
            "sheffield united",

        "sheffield united":
            "sheffield united",

        "sheff wed":
            "sheffield wednesday",

        "sheffield wed":
            "sheffield wednesday",

        "sheffield wednesday":
            "sheffield wednesday",

        "qpr":
            "queens park rangers",

        "queens park rangers":
            "queens park rangers",

        "west brom":
            "west bromwich albion",

        "wba":
            "west bromwich albion",

        "west bromwich albion":
            "west bromwich albion",

        # --------------------------------------------
        # Other common European abbreviations
        # --------------------------------------------

        "bayern":
            "bayern munich",

        "bayern munchen":
            "bayern munich",

        "bayern munich":
            "bayern munich",

        "dortmund":
            "borussia dortmund",

        "borussia dortmund":
            "borussia dortmund",

        "inter":
            "inter milan",

        "internazionale":
            "inter milan",

        "inter milan":
            "inter milan",

        "real madrid":
            "real madrid",

        "atletico madrid":
            "atletico madrid",

        "atleti":
            "atletico madrid",
    }


    @staticmethod
    def canonical_participant(
        name: str | None,
    ) -> str:

        normalized = (
            MatcherService.normalize(
                name
            )
        )

        return (
            MatcherService
            .TEAM_ALIASES
            .get(
                normalized,
                normalized,
            )
        )


    # ==================================================
    # LEAGUE ALIASES
    # ==================================================

    LEAGUE_ALIASES = {
        "la liga":
            "la liga",

        "spanish la liga":
            "la liga",

        "primera division":
            "la liga",

        "uefa champions league":
            "champions league",

        "champions league":
            "champions league",

        "english premier league":
            "premier league",

        "premier league":
            "premier league",

        "epl":
            "premier league",

        "a league":
            "a league",

        "a league men":
            "a league",
    }


    @staticmethod
    def canonical_league(
        league: str | None,
    ) -> str:

        normalized = (
            MatcherService.normalize(
                league
            )
        )

        return (
            MatcherService
            .LEAGUE_ALIASES
            .get(
                normalized,
                normalized,
            )
        )


    # ==================================================
    # SIMILARITY
    # ==================================================

    @staticmethod
    def similarity(
        text_a: str,
        text_b: str,
    ) -> float:
        """
        Similarity from 0.0 to 1.0.
        """

        if (
            not text_a
            or not text_b
        ):
            return 0.0

        if text_a == text_b:
            return 1.0

        return (
            fuzz.token_set_ratio(
                text_a,
                text_b,
            )
            / 100
        )


    # ==================================================
    # SPLIT PARTICIPANTS
    # ==================================================

    @staticmethod
    def _split_teams(
        event_name: str,
    ):

        normalized = (
            MatcherService.normalize(
                event_name
            )
        )

        parts = normalized.split(
            " vs "
        )

        if len(parts) != 2:
            return None

        return (
            MatcherService
            .canonical_participant(
                parts[0]
            ),

            MatcherService
            .canonical_participant(
                parts[1]
            ),
        )


    # ==================================================
    # DATE CONVERSION
    # ==================================================

    @staticmethod
    def australian_date(
        value,
    ):
        """
        Convert provider/Betfair start time
        to Australian calendar date.

        Supports:
        - Unix timestamp
        - datetime
        - ISO datetime string
        """

        if value is None:
            return None


        # Unix timestamp
        if isinstance(
            value,
            (int, float),
        ):

            dt = datetime.fromtimestamp(
                value,
                tz=timezone.utc,
            )


        # datetime object
        elif isinstance(
            value,
            datetime,
        ):

            dt = value

            if dt.tzinfo is None:
                dt = dt.replace(
                    tzinfo=timezone.utc
                )


        # ISO string
        elif isinstance(
            value,
            str,
        ):

            value = value.replace(
                "Z",
                "+00:00",
            )

            try:
                dt = datetime.fromisoformat(
                    value
                )

            except ValueError:
                return None

            if dt.tzinfo is None:
                dt = dt.replace(
                    tzinfo=timezone.utc
                )


        else:
            return None


        return (
            dt
            .astimezone(
                AUSTRALIA_TZ
            )
            .date()
        )


    # ==================================================
    # BETFAIR EVENT HELPERS
    # ==================================================

    @staticmethod
    def get_betfair_start_time(
        event_result,
    ):
        """
        Extract Betfair event open date.
        """

        event = getattr(
            event_result,
            "event",
            None,
        )

        if not event:
            return None

        return getattr(
            event,
            "open_date",
            None,
        )


    @staticmethod
    def get_betfair_league(
        event_result,
    ) -> str:
        """
        Extract competition/league name
        from a Betfair EventResult.
        """

        competition_name = getattr(
            event_result,
            "competition_name",
            None,
        )

        if competition_name:
            return str(
                competition_name
            )


        competition = getattr(
            event_result,
            "competition",
            None,
        )

        if competition:

            name = getattr(
                competition,
                "name",
                None,
            )

            if name:
                return str(name)


        return ""


    # ==================================================
    # STRICT PARTICIPANT COMPARISON
    # ==================================================

    @staticmethod
    def participants_match(
        odds_team_1: str,
        odds_team_2: str,
        betfair_team_1: str,
        betfair_team_2: str,
        sport: str = "",
        threshold: float = 0.82,
    ):
        """
        Both participants must independently pass
        the similarity threshold.

        For order-sensitive sports:
            A -> A
            B -> B

        For non-order-sensitive sports,
        swapped order is also allowed.
        """

        o1 = (
            MatcherService
            .canonical_participant(
                odds_team_1
            )
        )

        o2 = (
            MatcherService
            .canonical_participant(
                odds_team_2
            )
        )

        b1 = (
            MatcherService
            .canonical_participant(
                betfair_team_1
            )
        )

        b2 = (
            MatcherService
            .canonical_participant(
                betfair_team_2
            )
        )


        straight_1 = (
            MatcherService.similarity(
                o1,
                b1,
            )
        )

        straight_2 = (
            MatcherService.similarity(
                o2,
                b2,
            )
        )

        straight_ok = (
            straight_1 >= threshold
            and
            straight_2 >= threshold
        )


        sport_key = (
            MatcherService.normalize(
                sport
            )
        )

        config = (
            MatcherService
            .SPORT_CONFIG
            .get(
                sport_key,
                {
                    "order_sensitive":
                        True
                },
            )
        )


        # Most team sports:
        # do NOT allow reversed participants.
        if config[
            "order_sensitive"
        ]:

            return (
                straight_ok,
                min(
                    straight_1,
                    straight_2,
                ),
                "straight",
            )


        # Tennis / combat sports etc.
        swapped_1 = (
            MatcherService.similarity(
                o1,
                b2,
            )
        )

        swapped_2 = (
            MatcherService.similarity(
                o2,
                b1,
            )
        )

        swapped_ok = (
            swapped_1 >= threshold
            and
            swapped_2 >= threshold
        )


        straight_score = min(
            straight_1,
            straight_2,
        )

        swapped_score = min(
            swapped_1,
            swapped_2,
        )


        if (
            swapped_ok
            and
            swapped_score >
            straight_score
        ):

            return (
                True,
                swapped_score,
                "swapped",
            )


        return (
            straight_ok,
            straight_score,
            "straight",
        )


    # ==================================================
    # LEAGUE MATCHING
    # ==================================================

    @staticmethod
    def leagues_match(
        odds_league: str | None,
        betfair_league: str | None,
        threshold: float = 0.80,
    ) -> bool:
        """
        Known league mismatches are rejected.

        If Betfair doesn't provide league metadata,
        league validation is skipped rather than
        inventing a value.
        """

        odds_name = (
            MatcherService
            .canonical_league(
                odds_league
            )
        )

        betfair_name = (
            MatcherService
            .canonical_league(
                betfair_league
            )
        )


        if (
            not odds_name
            or not betfair_name
        ):
            return True


        if odds_name == betfair_name:
            return True


        score = (
            MatcherService.similarity(
                odds_name,
                betfair_name,
            )
        )

        return (
            score >= threshold
        )


    # ==================================================
    # FULL FIXTURE VALIDATION
    # ==================================================

    @staticmethod
    def fixture_matches(
        odds_event_name: str,
        betfair_event_name: str,

        odds_league: str | None = None,
        betfair_league: str | None = None,

        odds_start_time=None,
        betfair_start_time=None,

        sport: str = "",

        team_threshold: float = 0.82,
    ):
        """
        Strict fixture validation.

        Requires:

            participants ✓
            league ✓
            Australian date ✓

        Exact kickoff TIME is intentionally ignored.
        """

        odds_teams = (
            MatcherService._split_teams(
                odds_event_name
            )
        )

        betfair_teams = (
            MatcherService._split_teams(
                betfair_event_name
            )
        )


        if (
            not odds_teams
            or not betfair_teams
        ):
            return (
                False,
                0.0,
                "unable_to_split",
            )


        participant_ok, score, orientation = (
            MatcherService
            .participants_match(
                odds_teams[0],
                odds_teams[1],

                betfair_teams[0],
                betfair_teams[1],

                sport=sport,

                threshold=
                    team_threshold,
            )
        )


        if not participant_ok:

            return (
                False,
                score,
                "participants",
            )


        # ------------------------------------------
        # League validation
        # ------------------------------------------

        if not (
            MatcherService
            .leagues_match(
                odds_league,
                betfair_league,
            )
        ):

            return (
                False,
                score,
                "league",
            )


        # ------------------------------------------
        # Australian calendar date
        # ------------------------------------------

        odds_date = (
            MatcherService
            .australian_date(
                odds_start_time
            )
        )

        betfair_date = (
            MatcherService
            .australian_date(
                betfair_start_time
            )
        )


        # If both dates are available,
        # they MUST be identical.
        if (
            odds_date is not None
            and
            betfair_date is not None
            and
            odds_date != betfair_date
        ):

            return (
                False,
                score,
                "date",
            )


        return (
            True,
            score,
            orientation,
        )


    # ==================================================
    # FIND MATCHING EVENT
    # ==================================================

    @staticmethod
    def find_matching_event(
        odds_event_name,
        betfair_events,

        odds_league=None,
        odds_start_time=None,

        sport="",

        threshold: float = 0.82,

        debug: bool = False,
    ):
        """
        Find the Betfair event matching the complete
        fixture identity.

        We no longer choose a match solely because
        its event-name fuzzy score is high.
        """

        best_match = None
        best_score = 0.0

        candidates = []


        for event_result in betfair_events:

            event = getattr(
                event_result,
                "event",
                None,
            )

            if not event:
                continue


            betfair_name = getattr(
                event,
                "name",
                "",
            )


            betfair_start = (
                MatcherService
                .get_betfair_start_time(
                    event_result
                )
            )


            betfair_league = (
                MatcherService
                .get_betfair_league(
                    event_result
                )
            )


            (
                matched,
                score,
                reason,
            ) = (
                MatcherService
                .fixture_matches(
                    odds_event_name=
                        odds_event_name,

                    betfair_event_name=
                        betfair_name,

                    odds_league=
                        odds_league,

                    betfair_league=
                        betfair_league,

                    odds_start_time=
                        odds_start_time,

                    betfair_start_time=
                        betfair_start,

                    sport=
                        sport,

                    team_threshold=
                        threshold,
                )
            )


            candidates.append(
                (
                    matched,
                    score,
                    betfair_name,
                    betfair_league,
                    betfair_start,
                    reason,
                )
            )


            if (
                matched
                and
                score > best_score
            ):

                best_score = score
                best_match = event_result


        # ------------------------------------------
        # Debug
        # ------------------------------------------

        if debug:

            candidates.sort(
                key=lambda item:
                    item[1],
                reverse=True,
            )


            print()
            print(
                "STRICT MATCHER:"
            )

            print(
                odds_event_name
            )

            print(
                "League:",
                odds_league,
            )

            print(
                "Australian date:",
                MatcherService
                .australian_date(
                    odds_start_time
                ),
            )

            print()


            for (
                matched,
                score,
                name,
                league,
                start,
                reason,
            ) in candidates[:10]:

                print(
                    f"{'MATCH' if matched else 'REJECT'} "
                    f"| {score:.2f} "
                    f"| {name} "
                    f"| league={league} "
                    f"| AU date="
                    f"{MatcherService.australian_date(start)} "
                    f"| {reason}"
                )


            if best_match:

                print()
                print(
                    "SELECTED:",
                    best_match.event.name,
                    f"({best_score:.2f})",
                )

            else:

                print()
                print(
                    "NO VERIFIED MATCH"
                )


        return best_match


    # ==================================================
    # SELECTION MATCH
    # ==================================================

    @staticmethod
    def selection_matches(
        odds_selection: str,
        betfair_runner_name: str,
        threshold: float = 0.82,
    ) -> bool:

        odds_name = (
            MatcherService
            .canonical_participant(
                odds_selection
            )
        )

        runner_name = (
            MatcherService
            .canonical_participant(
                betfair_runner_name
            )
        )


        # Draw normalization
        draw_names = {
            "draw",
            "the draw",
            "x",
        }


        if (
            odds_name in draw_names
            and
            runner_name in draw_names
        ):
            return True


        if odds_name == runner_name:
            return True


        return (
            MatcherService.similarity(
                odds_name,
                runner_name,
            )
            >= threshold
        )


    # ==================================================
    # FIND RUNNER
    # ==================================================

    @staticmethod
    def find_matching_runner(
        odds_selection_name,
        runners,

        threshold: float = 0.82,

        debug: bool = False,
    ):

        odds_name = (
            MatcherService
            .canonical_participant(
                odds_selection_name
            )
        )


        # ------------------------------------------
        # Handle Draw separately
        # ------------------------------------------

        if odds_name in {
            "draw",
            "the draw",
            "x",
        }:

            for runner in runners:

                runner_name = (
                    MatcherService
                    .canonical_participant(
                        runner.runner_name
                    )
                )

                if runner_name in {
                    "draw",
                    "the draw",
                }:

                    if debug:
                        print(
                            "Runner match:",
                            odds_selection_name,
                            "->",
                            runner.runner_name,
                            "(DRAW)",
                        )

                    return runner


        # ------------------------------------------
        # Participant runner
        # ------------------------------------------

        best_runner = None
        best_score = 0.0


        for runner in runners:

            runner_name = (
                MatcherService
                .canonical_participant(
                    runner.runner_name
                )
            )


            score = (
                MatcherService
                .similarity(
                    odds_name,
                    runner_name,
                )
            )


            if (
                score >= threshold
                and
                score > best_score
            ):

                best_score = score
                best_runner = runner


        if debug:

            if best_runner:

                print(
                    "Runner match:",
                    odds_selection_name,
                    "->",
                    best_runner.runner_name,
                    f"({best_score:.2f})",
                )

            else:

                print(
                    "NO RUNNER MATCH:",
                    odds_selection_name,
                )


        return best_runner