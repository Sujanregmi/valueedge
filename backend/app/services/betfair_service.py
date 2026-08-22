import os

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

        # Cache event_id -> MATCH_ODDS catalogue
        self._market_cache = {}

    def login(self):
        self.client.login_interactive()

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

    def get_match_odds_market(
        self,
        event_id,
    ):
        """
        Fetch and cache the MATCH_ODDS market
        catalogue for one Betfair event.
        """

        event_id = str(event_id)

        if event_id in self._market_cache:
            return self._market_cache[
                event_id
            ]

        markets = (
            self.client.betting
            .list_market_catalogue(
                filter=filters.market_filter(
                    event_ids=[
                        event_id
                    ],
                    market_type_codes=[
                        "MATCH_ODDS"
                    ],
                ),
                max_results=5,
                market_projection=[
                    "RUNNER_DESCRIPTION"
                ],
            )
        )

        self._market_cache[
            event_id
        ] = markets

        return markets

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