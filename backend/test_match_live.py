from app.services.betfair_service import BetfairService
from app.services.matcher_service import MatcherService

betfair = BetfairService()
betfair.login()

# Cricket = event type 4
betfair_events = betfair.get_events(4)

odds_api_event = "Hampshire vs Essex"

match = MatcherService.find_matching_event(
    odds_api_event,
    betfair_events
)

if match:
    print("✅ Match Found!")
    print(match.event.name)
    print(match.event.id)
else:
    print("❌ No Match")