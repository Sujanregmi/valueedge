"use client";

import type { ArbitrageBet } from "./OddsTable";

export default function BetDetails({
  bet,
  close,
}: {
  bet: ArbitrageBet | null;
  close: () => void;
}) {
  if (!bet) return null;

  const {
    event,
    selection,
    bookmaker,
    exchange,
    back_odds,
    lay_odds,
    commission,
    profit_percentage,
    guaranteed_profit,
    stake_plan,
  } = bet;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">

      {/* Overlay */}
      <div
        onClick={close}
        className="
          absolute
          inset-0
          bg-black/40
          backdrop-blur-sm
        "
      />

      {/* Drawer */}
      <div
        className="
          relative
          w-full
          md:w-[460px]
          h-full
          bg-white
          shadow-2xl
          p-6
          overflow-y-auto
        "
      >
        {/* Header */}
        <div className="flex justify-between items-center">

          <div>
            <p className="text-sm text-slate-500">
              Arbitrage Opportunity
            </p>

            <h2 className="text-xl font-bold mt-1">
              Bet Details
            </h2>
          </div>

          <button
            onClick={close}
            className="
              text-gray-500
              hover:text-black
              text-xl
            "
          >
            ✕
          </button>

        </div>

        {/* Event */}
        <div className="mt-8">

          <h1 className="text-2xl font-bold">
            {event}
          </h1>

          <p className="text-slate-500 mt-2">
            Selection:{" "}
            <span className="font-semibold text-slate-800">
              {selection}
            </span>
          </p>

        </div>

        {/* Profit card */}
        <div
          className="
            mt-6
            bg-slate-900
            text-white
            rounded-xl
            p-5
          "
        >
          <p className="text-sm text-slate-300">
            Guaranteed Profit
          </p>

          <div className="flex justify-between items-end mt-3">

            <div>
              <p className="text-3xl font-bold text-green-400">
                ${guaranteed_profit.toFixed(2)}
              </p>

              <p className="text-sm text-slate-300 mt-1">
                Based on current quoted prices
              </p>
            </div>

            <p className="text-xl font-bold text-green-400">
              {profit_percentage.toFixed(2)}%
            </p>

          </div>
        </div>

        {/* Back bet */}
        <div
          className="
            mt-6
            border
            border-slate-200
            rounded-xl
            p-5
          "
        >
          <p className="text-sm text-slate-500">
            Step 1 · Back Bet
          </p>

          <div className="flex justify-between mt-3">

            <div>
              <p className="font-bold text-lg">
                {bookmaker}
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Back {selection}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">
                {back_odds}
              </p>

              <p className="text-sm text-slate-500">
                Back odds
              </p>
            </div>

          </div>

          <div
            className="
              mt-4
              bg-slate-50
              rounded-lg
              p-4
              flex
              justify-between
            "
          >
            <span className="text-slate-600">
              Stake
            </span>

            <span className="font-bold">
              ${stake_plan.bookmaker_stake.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Lay bet */}
        <div
          className="
            mt-4
            border
            border-slate-200
            rounded-xl
            p-5
          "
        >
          <p className="text-sm text-slate-500">
            Step 2 · Lay Bet
          </p>

          <div className="flex justify-between mt-3">

            <div>
              <p className="font-bold text-lg">
                {exchange}
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Lay {selection}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">
                {lay_odds}
              </p>

              <p className="text-sm text-slate-500">
                Lay odds
              </p>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500">
                Lay Stake
              </p>

              <p className="font-bold mt-1">
                ${stake_plan.betfair_lay_stake.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500">
                Liability
              </p>

              <p className="font-bold mt-1">
                ${stake_plan.lay_liability.toFixed(2)}
              </p>
            </div>

          </div>
        </div>

        {/* Summary */}
        <div
          className="
            mt-6
            grid
            grid-cols-2
            gap-4
          "
        >
          <div className="bg-slate-100 rounded-xl p-4">
            <p className="text-sm text-slate-500">
              Commission
            </p>

            <p className="text-xl font-bold mt-1">
              {(commission * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-slate-100 rounded-xl p-4">
            <p className="text-sm text-slate-500">
              Capital Required
            </p>

            <p className="text-xl font-bold mt-1">
              $
              {stake_plan.total_capital_required.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div
          className="
            mt-6
            bg-green-50
            rounded-xl
            p-5
          "
        >
          <p className="font-semibold text-green-800">
            Execution Plan
          </p>

          <p className="text-sm text-green-800 mt-3">
            Back{" "}
            <strong>{selection}</strong>{" "}
            at{" "}
            <strong>{bookmaker}</strong>{" "}
            for{" "}
            <strong>
              ${stake_plan.bookmaker_stake.toFixed(2)}
            </strong>{" "}
            at odds{" "}
            <strong>{back_odds}</strong>.
          </p>

          <p className="text-sm text-green-800 mt-3">
            Then lay{" "}
            <strong>{selection}</strong>{" "}
            at{" "}
            <strong>{exchange}</strong>{" "}
            for{" "}
            <strong>
              ${stake_plan.betfair_lay_stake.toFixed(2)}
            </strong>{" "}
            at lay odds{" "}
            <strong>{lay_odds}</strong>.
          </p>
        </div>

        {/* Warning */}
        <div
          className="
            mt-6
            bg-amber-50
            border
            border-amber-200
            rounded-xl
            p-4
          "
        >
          <p className="text-sm text-amber-800">
            Odds can move quickly. Recheck both the bookmaker
            price and Betfair lay price before placing either bet.
          </p>
        </div>

        <button
          onClick={close}
          className="
            w-full
            mt-8
            bg-slate-900
            hover:bg-slate-800
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Close
        </button>

      </div>
    </div>
  );
}