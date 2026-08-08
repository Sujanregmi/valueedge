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

    def login(self):
        self.client.login_interactive()

    def get_event_types(self):
        return self.client.betting.list_event_types()

    def get_events(self, event_type_id):

        return self.client.betting.list_events(
            filter=filters.market_filter(
                event_type_ids=[str(event_type_id)]
            )
        )
    
    def get_match_odds_market(self, event_id):
        markets = self.client.betting.list_market_catalogue(
        filter=filters.market_filter(
            event_ids=[event_id],
            market_type_codes=["MATCH_ODDS"]
        ),
        max_results=5,
        market_projection=["RUNNER_DESCRIPTION"]
    )
        return markets
    

    def get_market_book(self, market_id):
        books=self.client.betting.list_market_book(
        market_ids=[market_id],
        price_projection=filters.price_projection(
            price_data=["EX_BEST_OFFERS"]
        )
    )
        return books
    def get_lay_price_for_selection(self, market_id, selection_id):

        books = self.client.betting.list_market_book(
            market_ids=[market_id],
            price_projection=filters.price_projection(
            price_data=["EX_BEST_OFFERS"]
        )
    )

        for runner in books[0].runners:

            if runner.selection_id == selection_id:

             if runner.ex.available_to_lay:

                return runner.ex.available_to_lay[0].price

        return None