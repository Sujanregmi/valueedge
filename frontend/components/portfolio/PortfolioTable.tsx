"use client";

import {
  Fragment,
  useState,
} from "react";

import {
  type PortfolioBet,
} from "@/lib/betLog";


type PortfolioTab =
  | "open"
  | "settled";

type SortOption =
  | "placed"
  | "start";


export default function PortfolioTable({
  bets,
  setBets,
}: {
  bets: PortfolioBet[];
  setBets: (
    bets: PortfolioBet[]
  ) => void;
}) {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<PortfolioTab>(
      "open"
    );

  const [
    sortBy,
    setSortBy,
  ] =
    useState<SortOption>(
      "placed"
    );

  const [
    expandedBet,
    setExpandedBet,
  ] =
    useState<string | null>(
      null
    );


  const openCount =
    bets.filter(
      bet =>
        bet.status === "open"
    ).length;

  const settledCount =
    bets.filter(
      bet =>
        bet.status === "settled"
    ).length;


  const visibleBets =
    [...bets]
      .filter(
        bet =>
          bet.status ===
          activeTab
      )
      .sort(
        (a, b) => {

          if (
            sortBy === "start"
          ) {
            const aTime =
              a.start_time
                ? new Date(
                  a.start_time
                ).getTime()
                : Number.MAX_SAFE_INTEGER;

            const bTime =
              b.start_time
                ? new Date(
                  b.start_time
                ).getTime()
                : Number.MAX_SAFE_INTEGER;

            return (
              aTime -
              bTime
            );
          }

          return (
            new Date(
              b.placed_at
            ).getTime() -
            new Date(
              a.placed_at
            ).getTime()
          );
        }
      );


  function settleBet(
    bet: PortfolioBet
  ) {
    const value =
      window.prompt(
        "Enter settled profit/loss. Example: 4.25 or -10"
      );

    if (
      value === null
    ) {
      return;
    }

    const amount =
      Number(value);

    if (
      !Number.isFinite(
        amount
      )
    ) {
      window.alert(
        "Please enter a valid number."
      );

      return;
    }

    const updated =
      bets.map(
        item =>
          item.id === bet.id
            ? {
              ...item,
              status:
                "settled" as const,
              settled_profit:
                amount,
              result:
                amount > 0
                  ? "won" as const
                  : amount < 0
                    ? "lost" as const
                    : "push" as const,
            }
            : item
      );

    setBets(
      updated
    );
  }


  function reopenBet(
    bet: PortfolioBet
  ) {
    setBets(
      bets.map(
        item =>
          item.id === bet.id
            ? {
              ...item,
              status:
                "open" as const,
              settled_profit:
                null,
              result:
                null,
            }
            : item
      )
    );
  }


  function deleteBet(
    bet: PortfolioBet
  ) {
    const confirmed =
      window.confirm(
        `Delete ${bet.event} from the Bet Log?`
      );

    if (!confirmed) {
      return;
    }

    setBets(
      bets.filter(
        item =>
          item.id !==
          bet.id
      )
    );
  }


  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    return date.toLocaleString();
  }


  return (
    <div className="
      bg-white
      border
      border-slate-200
      rounded-2xl
      shadow-sm
      overflow-hidden
    ">


      {/* Controls */}

      <div className="
        flex
        flex-col
        lg:flex-row
        lg:items-center
        justify-between
        gap-4
        px-6
        py-5
        border-b
        border-slate-200
      ">

        <div className="
          flex
          items-center
          gap-2
        ">

          <button
            onClick={() =>
              setActiveTab(
                "open"
              )
            }
            className={`
              px-4
              py-2
              rounded-lg
              text-sm
              font-semibold
              transition
              ${activeTab === "open"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            `}
          >
            Open ({openCount})
          </button>


          <button
            onClick={() =>
              setActiveTab(
                "settled"
              )
            }
            className={`
              px-4
              py-2
              rounded-lg
              text-sm
              font-semibold
              transition
              ${activeTab ===
                "settled"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            `}
          >
            Settled ({settledCount})
          </button>

        </div>


        <div className="
          flex
          items-center
          gap-3
        ">

          <span className="
            text-sm
            text-slate-500
          ">
            Sort by
          </span>

          <select
            value={sortBy}
            onChange={
              event =>
                setSortBy(
                  event.target.value as SortOption
                )
            }
            className="
              border
              border-slate-300
              rounded-lg
              px-3
              py-2
              text-sm
              bg-white
            "
          >
            <option value="placed">
              Bet placed
            </option>

            <option value="start">
              Play start
            </option>
          </select>

        </div>

      </div>


      {visibleBets.length === 0 ? (

        <div className="
          py-16
          text-center
          text-slate-500
        ">
          No {activeTab} bets.
        </div>

      ) : (

        <div className="
          overflow-x-auto
        ">

          <table className="
            w-full
            min-w-[1450px]
          ">

            <thead className="
              bg-slate-50
              border-b
              border-slate-200
            ">

              <tr className="
                text-[11px]
                uppercase
                tracking-wider
                text-slate-500
              ">

                <th className="
                  px-4
                  py-3
                  text-left
                ">
                  Match
                </th>

                <th className="
                  px-4
                  py-3
                  text-left
                ">
                  Selection
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Back
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Lay
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Back stake
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Lay stake
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Liability
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Expected
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  ROI
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Status
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  P/L
                </th>

                <th className="
                  px-4
                  py-3
                  text-center
                ">
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {visibleBets.map(
                bet => {
                  const isCrossBook =
                    bet.type === "CROSS_BOOK_ARBITRAGE" &&
                    !!bet.legs?.length;

                  return (

                    <Fragment key={bet.id}>
                      <tr
                        key={bet.id}
                        className="
                        border-b
                        border-slate-100
                        hover:bg-slate-50
                      "
                      >


                        {/* MATCH */}

                        <td className="
                        px-4
                        py-4
                      ">

                          <button
                            onClick={() =>
                              setExpandedBet(
                                expandedBet ===
                                  bet.id
                                  ? null
                                  : bet.id
                              )
                            }
                            className="
                            text-left
                          "
                          >

                            <p className="
                            font-semibold
                            text-slate-900
                          ">
                              {bet.event}
                            </p>

                            <p className="
                            text-xs
                            text-slate-500
                            mt-1
                          ">
                              {formatDate(
                                bet.placed_at
                              )}
                            </p>

                          </button>

                        </td>


                        {/* SELECTION */}

                        {/* SELECTION */}

                        <td className="px-4 py-4 font-medium">
                          {isCrossBook ? (
                            <div className="space-y-2">
                              {bet.legs!.map((leg, index) => (
                                <div key={index}>
                                  {leg.selection}
                                </div>
                              ))}
                            </div>
                          ) : (
                            bet.selection
                          )}
                        </td>
                        {/* BACK / CROSS-BOOK LEG 1 */}

                        <td className="
                          px-4
                          py-4
                          text-center
                        ">
                          {isCrossBook ? (
                            bet.legs?.[0] ? (
                              <div className="
                                inline-block
                                bg-sky-50
                                border
                                border-sky-200
                                rounded-lg
                                px-3
                                py-2
                              ">
                                <p className="text-xs text-sky-600">
                                  {bet.legs[0].bookmaker}
                                </p>

                                <p className="font-bold text-sky-700">
                                  {bet.legs[0].odds}
                                </p>
                              </div>
                            ) : (
                              "—"
                            )
                          ) : (
                            <div className="
                              inline-block
                              bg-sky-50
                              border
                              border-sky-200
                              rounded-lg
                              px-3
                              py-2
                            ">
                              <p className="text-xs text-sky-600">
                                {bet.bookmaker}
                              </p>

                              <p className="font-bold text-sky-700">
                                {bet.back_odds}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* LAY */}
                        {/* LAY / CROSS-BOOK LEG 2 */}

                        <td className="
                          px-4
                          py-4
                          text-center
                        ">
                          {isCrossBook ? (
                            bet.legs?.[1] ? (
                              <div className="
                                inline-block
                                bg-pink-50
                                border
                                border-pink-200
                                rounded-lg
                                px-3
                                py-2
                              ">
                                <p className="text-xs text-pink-600">
                                  {bet.legs[1].bookmaker}
                                </p>

                                <p className="font-bold text-pink-700">
                                  {bet.legs[1].odds}
                                </p>
                              </div>
                            ) : (
                              "—"
                            )
                          ) : (
                            <div className="
                              inline-block
                              bg-pink-50
                              border
                              border-pink-200
                              rounded-lg
                              px-3
                              py-2
                            ">
                              <p className="text-xs text-pink-600">
                                {bet.exchange}
                              </p>

                              <p className="font-bold text-pink-700">
                                {bet.lay_odds}
                              </p>
                            </div>
                          )}
                        </td>


                        <td className="
                        px-4
                        py-4
                        text-center
                        font-semibold
                      ">
                          $
                          {bet
                            .stake_plan
                            .bookmaker_stake
                            .toFixed(2)}
                        </td>


                        <td className="
                        px-4
                        py-4
                        text-center
                      ">
                          $
                          {bet
                            .stake_plan
                            .betfair_lay_stake
                            .toFixed(2)}
                        </td>


                        <td className="
                        px-4
                        py-4
                        text-center
                      ">
                          $
                          {bet
                            .stake_plan
                            .lay_liability
                            .toFixed(2)}
                        </td>


                        <td className="
                        px-4
                        py-4
                        text-center
                        text-green-600
                        font-semibold
                      ">
                          +$
                          {bet
                            .guaranteed_profit
                            .toFixed(2)}
                        </td>


                        <td className="
                        px-4
                        py-4
                        text-center
                      ">

                          <span className="
                          bg-green-50
                          text-green-700
                          rounded-lg
                          px-2.5
                          py-1
                          font-bold
                        ">
                            +
                            {bet
                              .profit_percentage
                              .toFixed(2)}
                            %
                          </span>

                        </td>


                        {/* STATUS */}

                        <td className="
                        px-4
                        py-4
                        text-center
                      ">

                          <span
                            className={`
                            px-3
                            py-1
                            rounded-full
                            text-xs
                            font-bold
                            ${bet.status ===
                                "open"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                              }
                          `}
                          >
                            {bet.status ===
                              "open"
                              ? "OPEN"
                              : "SETTLED"}
                          </span>

                        </td>


                        {/* P/L */}

                        <td className="
                        px-4
                        py-4
                        text-center
                        font-bold
                      ">

                          {bet.status ===
                            "settled" ? (

                            <span
                              className={
                                (
                                  bet.settled_profit ??
                                  0
                                ) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {(
                                bet.settled_profit ??
                                0
                              ) >= 0
                                ? "+"
                                : ""}
                              $
                              {(
                                bet.settled_profit ??
                                0
                              ).toFixed(2)}
                            </span>

                          ) : (
                            <span className="
                            text-slate-400
                          ">
                              —
                            </span>
                          )}

                        </td>


                        {/* ACTIONS */}

                        <td className="
                        px-4
                        py-4
                        text-center
                      ">

                          <div className="
                          flex
                          justify-center
                          gap-2
                        ">

                            {bet.status ===
                              "open" ? (

                              <button
                                onClick={() =>
                                  settleBet(
                                    bet
                                  )
                                }
                                className="
                                bg-green-500
                                hover:bg-green-600
                                text-white
                                text-xs
                                px-3
                                py-2
                                rounded-lg
                              "
                              >
                                Settle
                              </button>

                            ) : (

                              <button
                                onClick={() =>
                                  reopenBet(
                                    bet
                                  )
                                }
                                className="
                                bg-slate-100
                                hover:bg-slate-200
                                text-slate-700
                                text-xs
                                px-3
                                py-2
                                rounded-lg
                              "
                              >
                                Reopen
                              </button>

                            )}


                            <button
                              onClick={() =>
                                deleteBet(
                                  bet
                                )
                              }
                              className="
                              text-red-500
                              hover:bg-red-50
                              text-xs
                              px-3
                              py-2
                              rounded-lg
                            "
                            >
                              Delete
                            </button>

                          </div>

                        </td>

                      </tr>


                      {/* EXPANDED DETAILS */}

                      {expandedBet ===
                        bet.id && (

                          <tr
                            key={`${bet.id}-details`}
                          >

                            <td
                              colSpan={12}
                              className="
                            bg-slate-50
                            px-6
                            py-5
                          "
                            >

                              <div className="
                            grid
                            grid-cols-2
                            md:grid-cols-4
                            gap-4
                          ">

                                <div>
                                  <p className="
                                text-xs
                                text-slate-500
                              ">
                                    Total capital
                                  </p>

                                  <p className="
                                font-bold
                                mt-1
                              ">
                                    $
                                    {bet
                                      .stake_plan
                                      .total_capital_required
                                      .toFixed(2)}
                                  </p>
                                </div>


                                <div>
                                  <p className="
                                text-xs
                                text-slate-500
                              ">
                                    Commission
                                  </p>

                                  <p className="
                                font-bold
                                mt-1
                              ">
                                    {(
                                      bet.commission *
                                      100
                                    ).toFixed(1)}
                                    %
                                  </p>
                                </div>


                                <div>
                                  <p className="
                                text-xs
                                text-slate-500
                              ">
                                    Play start
                                  </p>

                                  <p className="
                                font-bold
                                mt-1
                              ">
                                    {formatDate(
                                      bet.start_time
                                    )}
                                  </p>
                                </div>


                                <div>
                                  <p className="
                                text-xs
                                text-slate-500
                              ">
                                    CLV
                                  </p>

                                  <p className="
                                font-bold
                                mt-1
                              ">
                                    {bet.clv ===
                                      null
                                      ? "—"
                                      : `${bet.clv >= 0
                                        ? "+"
                                        : ""
                                      }${bet.clv.toFixed(
                                        2
                                      )}%`}
                                  </p>
                                </div>

                              </div>

                            </td>

                          </tr>

                        )}

                    </Fragment>
                  );
                }

              )}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}