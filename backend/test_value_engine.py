from app.engine.value_engine import calculate_back_lay_arbitrage


result = calculate_back_lay_arbitrage(
    bookmaker_back_odds=2.10,
    betfair_lay_odds=1.90,
    bankroll=1000
)


print(result)