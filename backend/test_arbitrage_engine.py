from app.engine.arbitrage_engine import find_back_lay_arbitrage

result = find_back_lay_arbitrage(
    event="Sydney FC vs Melbourne Victory",
    selection="Sydney FC",
    bookmaker="Sportsbet",
    bookmaker_back_odds=2.50,
    exchange="Betfair",
    betfair_lay_odds=2.20,
    bookmaker_stake=100,
    commission=0.05
)

print(result)