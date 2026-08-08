from app.engine.value_engine import calculate_back_lay_arbitrage


def find_back_lay_arbitrage(
        event,
        selection,
        bookmaker,
        bookmaker_back_odds,
        exchange,
        betfair_lay_odds,
        bookmaker_stake=100,
        commission=0.05
):

    result = calculate_back_lay_arbitrage(
        bookmaker_back_odds=bookmaker_back_odds,
        betfair_lay_odds=betfair_lay_odds,
        bookmaker_stake=bookmaker_stake,
        commission=commission
    )

    if result["arbitrage"]:

        return {

            "event": event,
            "selection": selection,
            "bookmaker": bookmaker,
            "exchange": exchange,
            "type": "BACK_LAY_ARBITRAGE",
            "back_odds": bookmaker_back_odds,
            "lay_odds": betfair_lay_odds,
            "commission": commission,

            "profit_percentage": result["profit_percentage"],
            "guaranteed_profit": result["guaranteed_profit"],

            "stake_plan": {
                "bookmaker_stake": result["bookmaker_stake"],
                "betfair_lay_stake": result["betfair_lay_stake"],
                "lay_liability": result["lay_liability"],
                "total_capital_required": result["total_capital_required"],
            }

        }

    return None