from app.services.matcher_service import MatcherService

print(
    MatcherService.events_match(
        "Hampshire vs Essex",
        "Hampshire v Essex"
    )
)