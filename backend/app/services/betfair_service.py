import os
import time

import betfairlightweight
from betfairlightweight import filters
from dotenv import load_dotenv

load_dotenv()


class BetfairService:
    def __init__(self):
        self.client = betfairlightweight.APIClient(
            username=os.getenv("BETFAIR_USERNAME"),
            password=os.getenv("BETFAIR_PASSWORD"),
            app_key=os.getenv("BETFAIR_APP_KEY"),
        )

        # betfairlightweight defaults to a 3.05s read timeout on
        # every endpoint (connect_timeout/read_timeout are class
        # attributes, not constructor args). That's too tight for
        # listMarketCatalogue once multiple market types are
        # requested per call -- raise it here.
        self.client.betting.connect_timeout = 10
        self.client.betting.read_timeout = 30

        # login_interactive() goes through a SEPARATE identitysso
        # endpoint, not client.betting -- it was never covered by
        # the timeout override above. With no ceiling at all, a
        # slow/unresponsive login attempt (e.g. on sport #2 of an
        # 8-sport scan cycle) could hang indefinitely with no error
        # ever surfacing, which is what "scanner just stops" looks
        # like from the outside.
        self.client.login.connect_timeout = 10
        self.client.login.read_timeout = 30

        # Cache event_id -> MATCH_ODDS catalogue
        self._market_cache = {}

    def login(self, retries=2):
        last_exc = None

        for attempt in range(1, retries + 2):
            try:
                self.client.login_interactive()
                return
            except Exception as exc:
                last_exc = exc
                print(
                    f"Betfair login attempt {attempt} failed:",
                    repr(exc),
                )
                if attempt <= retries:
                    time.sleep(2 * attempt)

        raise last_exc

    def get_event_types(self):
        return self.client.betting.list_event_types()

    def get_events(self, event_type_id):
        return self.client.betting.list_events(
            filter=filters.market_filter(
                event_type_ids=[
                    str(event_type_id)
                ]
            )
        )


    def get_markets(self, event_id, market_type_codes, max_results=20, retries=2):
        event_id = str(event_id)
        cache_key = (event_id, tuple(sorted(market_type_codes)))

        if cache_key in self._market_cache:
            return self._market_cache[cache_key]

        last_exc = None
        for attempt in range(1, retries + 2):
            try:
                markets = self.client.betting.list_market_catalogue(
                    filter=filters.market_filter(
                        event_ids=[event_id],
                        market_type_codes=market_type_codes,
                    ),
                    max_results=max_results,
                    market_projection=["RUNNER_DESCRIPTION", "MARKET_DESCRIPTION"],
                )
                self._market_cache[cache_key] = markets
                return markets
            except Exception as exc:
                last_exc = exc
                print(f"get_markets attempt {attempt} failed for {event_id}:", repr(exc))
                if attempt <= retries:
                    time.sleep(1.5 * attempt)

        raise last_exc

    def get_match_odds_market(self, event_id):
        """Back-compat wrapper — existing H2H code keeps working."""
        return self.get_markets(event_id, ["MATCH_ODDS"], max_results=5)

    def get_market_book(
        self,
        market_id,
    ):
        books = (
            self.client.betting
            .list_market_book(
                market_ids=[
                    market_id
                ],
                price_projection=(
                    filters.price_projection(
                        price_data=[
                            "EX_BEST_OFFERS"
                        ]
                    )
                ),
            )
        )

        return books

    def get_market_books(
        self,
        market_ids,
    ):
        """
        Fetch multiple Betfair markets in
        one listMarketBook request.

        This is much faster than requesting
        every market separately.
        """

        if not market_ids:
            return []

        return (
            self.client.betting
            .list_market_book(
                market_ids=[
                    str(market_id)
                    for market_id in market_ids
                ],
                price_projection=(
                    filters.price_projection(
                        price_data=[
                            "EX_BEST_OFFERS"
                        ]
                    )
                ),
            )
        )

    def get_lay_price_for_selection(
        self,
        market_id,
        selection_id,
        market_book=None,
    ):
        """
        Return best available lay price.

        If market_book is supplied, no API
        request is made.
        """

        if market_book is None:

            books = self.get_market_book(
                market_id
            )

            if not books:
                return None

            market_book = books[0]

        for runner in market_book.runners:

            if (
                runner.selection_id
                == selection_id
            ):

                if (
                    runner.ex
                    and runner.ex.available_to_lay
                ):
                    return (
                        runner.ex
                        .available_to_lay[0]
                        .price
                    )

        return None

    def build_market_book_map(
        self,
        market_ids,
        batch_size=20,
    ):
        """
        Fetch Betfair market books in batches
        and return:

        {
            market_id: MarketBook
        }
        """

        market_map = {}

        market_ids = [
            str(market_id)
            for market_id in market_ids
        ]

        for start in range(
            0,
            len(market_ids),
            batch_size,
        ):

            batch = market_ids[
                start:
                start + batch_size
            ]

            books = self.get_market_books(
                batch
            )

            for book in books:
                market_map[
                    str(book.market_id)
                ] = book

        return market_map