"""
Cross-book ("surebet") arbitrage detection.

Different from find_back_lay_arbitrage: no exchange/Betfair leg at
all. Compares the best back odds for EVERY outcome of an event
across different bookmakers. If the combined implied probability of
all outcomes is under 1.0, backing every outcome at its best price
guarantees a profit no matter which one actually happens.

Generalizes automatically to however many selections exist in
best_back_odds:
    - 2-way market (tennis moneyline, totals over/under) -> 2 legs
    - 3-way market (soccer 1X2: home/draw/away)          -> 3 legs
"""


def find_cross_book_arbitrage(
    event: str,
    best_back_odds: dict,
    total_stake: float = 100,
    min_profit_pct: float = 0.5,
):
    """
    best_back_odds shape:

    {
        selection_name: {
            "odds": float,
            "bookmaker": str,
            "link": str | None,
        }
    }

    Returns None if:
        - fewer than 2 selections are present
        - all selections' best price came from the same bookmaker
        - combined implied probability is >= 1.0
        - resulting profit is below min_profit_pct

    Otherwise returns a cross-book arbitrage result with one leg
    per selection. Each leg also carries the bookmaker deep link
    returned by The Odds API when available.
    """

    if len(best_back_odds) < 2:
        return None

    bookmakers_used = {
        info["bookmaker"]
        for info in best_back_odds.values()
    }

    if len(bookmakers_used) < 2:
        return None

    try:
        implied_prob_sum = sum(
            1 / info["odds"]
            for info in best_back_odds.values()
        )
    except (
        KeyError,
        TypeError,
        ZeroDivisionError,
    ):
        return None

    if implied_prob_sum >= 1.0:
        return None

    profit_percentage = (
        (1 / implied_prob_sum) - 1
    ) * 100

    if profit_percentage < min_profit_pct:
        return None

    legs = []

    for selection, info in best_back_odds.items():

        odds = info["odds"]

        bookmaker = info["bookmaker"]

        # ------------------------------------------
        # BOOKMAKER DEEP LINK
        # ------------------------------------------

        bookmaker_link = info.get("link")

        # ------------------------------------------
        # CALCULATE STAKE
        # ------------------------------------------

        stake = (
            total_stake
            * (1 / odds)
            / implied_prob_sum
        )

        legs.append(
            {
                "selection": selection,
                "bookmaker": bookmaker,
                "odds": odds,
                "stake": round(
                    stake,
                    2,
                ),
                "payout_if_wins": round(
                    stake * odds,
                    2,
                ),

                # ----------------------------------
                # IMPORTANT:
                # Preserve bookmaker deep link
                # for the frontend.
                # ----------------------------------

                "link": bookmaker_link,
            }
        )

    total_staked = sum(
        leg["stake"]
        for leg in legs
    )

    guaranteed_profit = round(
        legs[0]["payout_if_wins"]
        - total_staked,
        2,
    )

    return {
        "event": event,
        "type": "CROSS_BOOK_ARBITRAGE",
        "legs": legs,
        "total_stake": round(
            total_staked,
            2,
        ),
        "profit_percentage": round(
            profit_percentage,
            2,
        ),
        "guaranteed_profit": guaranteed_profit,
    }