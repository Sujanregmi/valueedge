import re
import unicodedata
from rapidfuzz import fuzz


class MatcherService:

    @staticmethod
    def normalize(text: str) -> str:
        """
        Normalize team and event names for matching.
        """
        # Strip accents (Győr -> Gyor, etc)
        text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")

        text = text.lower()
        text = text.replace(" v ", " vs ")
        text = re.sub(r"[^a-z0-9 ]", "", text)
        text = re.sub(r"\s+", " ", text).strip()

        # "The Draw" (Betfair) vs "Draw" (Odds API), "The New Saints" etc.
        if text.startswith("the "):
            text = text[4:]

        return text

    @staticmethod
    def similarity(text_a: str, text_b: str) -> float:
        """
        Token-based fuzzy similarity, 0 to 1. Handles word reordering
        ("Riga FC" vs "FK Riga") and prefix/suffix differences
        ("FC Flora" vs "Tallinna FC Flora") far better than plain
        character-sequence comparison.
        """
        return fuzz.token_set_ratio(text_a, text_b) / 100

    @staticmethod
    def _split_teams(normalized_event_name: str):
        """
        Split a normalized "team a vs team b" string into its two team
        names. Returns None if it doesn't look like a two-team event name.
        """
        parts = normalized_event_name.split(" vs ")
        if len(parts) == 2:
            return parts[0].strip(), parts[1].strip()
        return None

    @staticmethod
    def events_match(odds_api_event: str, betfair_event: str, threshold: float = 0.55) -> bool:
        """
        Compare two event names, tolerant of team order and naming
        differences (abbreviations, word order, city-name prefixes,
        punctuation, accents).

        Requires BOTH team names to independently clear the threshold -
        this avoids false positives where one strongly-matching team
        name drags up an overall similarity score even though the other
        team is completely different (e.g. "Craiova vs Vitebsk" vs
        "Craiova vs Maxline" - matching on "Craiova" alone isn't enough).
        """
        odds_name = MatcherService.normalize(odds_api_event)
        betfair_name = MatcherService.normalize(betfair_event)

        if odds_name == betfair_name:
            return True

        odds_teams = MatcherService._split_teams(odds_name)
        betfair_teams = MatcherService._split_teams(betfair_name)

        if odds_teams and betfair_teams:
            o1, o2 = odds_teams
            b1, b2 = betfair_teams

            straight = (
                MatcherService.similarity(o1, b1) >= threshold
                and MatcherService.similarity(o2, b2) >= threshold
            )
            swapped = (
                MatcherService.similarity(o1, b2) >= threshold
                and MatcherService.similarity(o2, b1) >= threshold
            )
            return straight or swapped

        # Fallback for names that don't split into two teams cleanly
        return MatcherService.similarity(odds_name, betfair_name) >= threshold

    @staticmethod
    def selection_matches(odds_selection: str, betfair_runner_name: str, threshold: float = 0.55) -> bool:
        """
        Compare an individual selection/team name (Odds API outcome name)
        against a Betfair runner name.
        """
        odds_name = MatcherService.normalize(odds_selection)
        runner_name = MatcherService.normalize(betfair_runner_name)

        if odds_name == runner_name:
            return True

        return MatcherService.similarity(odds_name, runner_name) >= threshold

    @staticmethod
    def find_matching_event(odds_event_name, betfair_events):
        best_match = None
        best_score = 0.0

        for event in betfair_events:
            betfair_name = event.event.name

            if MatcherService.events_match(odds_event_name, betfair_name):
                score = MatcherService.similarity(
                    MatcherService.normalize(odds_event_name),
                    MatcherService.normalize(betfair_name),
                )
                if score > best_score:
                    best_score = score
                    best_match = event

        return best_match

    @staticmethod
    def find_matching_runner(odds_selection_name, runners):
        """
        runners: list of Betfair RunnerCatalogue objects (with .runner_name
        and .selection_id), typically from market_catalogue[0].runners
        """
        for runner in runners:
            if MatcherService.selection_matches(odds_selection_name, runner.runner_name):
                return runner
        return None