def implied_probability(odds: float):
    return 1 / odds


def calculate_fair_odds(probability: float):
    return round(1 / probability, 2)


def calculate_edge(bookmaker_odds: float, fair_odds: float):

    bookmaker_probability = implied_probability(bookmaker_odds)
    fair_probability = implied_probability(fair_odds)

    edge = (
        fair_probability - bookmaker_probability
    )

    return round(edge * 100, 2)



# -------------------------------
# BETFAIR ARBITRAGE CALCULATOR
# -------------------------------
def calculate_back_lay_arbitrage(
        bookmaker_back_odds: float,
        betfair_lay_odds: float,
        bookmaker_stake: float,
        commission: float = 0.05
):
    """
    Bookmaker BACK + Betfair LAY arbitrage calculator.

    bookmaker_stake: the amount you're backing with at the bookmaker.
    The lay stake is derived from this so that profit is equal
    regardless of outcome, once Betfair commission is accounted for.
    """

    betfair_lay_stake = (
        bookmaker_stake * bookmaker_back_odds
    ) / (betfair_lay_odds - commission)

    lay_liability = betfair_lay_stake * (betfair_lay_odds - 1)

    bookmaker_profit = (
        bookmaker_stake * (bookmaker_back_odds - 1)
        - lay_liability
    )

    betfair_profit = (
        betfair_lay_stake * (1 - commission)
        - bookmaker_stake
    )

    guaranteed_profit = min(bookmaker_profit, betfair_profit)

    total_capital = bookmaker_stake + lay_liability

    profit_percentage = (
        (guaranteed_profit / total_capital) * 100
        if total_capital > 0 else 0
    )

    return {
        "arbitrage": guaranteed_profit > 0,
        "bookmaker_back_odds": bookmaker_back_odds,
        "betfair_lay_odds": betfair_lay_odds,
        "commission": commission,
        "bookmaker_stake": round(bookmaker_stake, 2),
        "betfair_lay_stake": round(betfair_lay_stake, 2),
        "lay_liability": round(lay_liability, 2),
        "total_capital_required": round(total_capital, 2),
        "guaranteed_profit": round(guaranteed_profit, 2),
        "profit_percentage": round(profit_percentage, 2),
    }