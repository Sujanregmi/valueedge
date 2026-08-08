from app.services.betfair_service import BetfairService

betfair = BetfairService()
betfair.login()

events = betfair.get_events(4)   # Cricket

event = events[0]

print(f"\nEvent: {event.event.name}")

markets = betfair.get_match_odds_market(event.event.id)

market = markets[0]

print(f"Market: {market.market_name}")

books = betfair.get_market_book(market.market_id)

book = books[0]

for runner in book.runners:

    print("--------------------------------")

    print("Selection ID:", runner.selection_id)

    if runner.ex.available_to_back:
        print("Best Back:",
              runner.ex.available_to_back[0].price)

    if runner.ex.available_to_lay:
        print("Best Lay:",
              runner.ex.available_to_lay[0].price)