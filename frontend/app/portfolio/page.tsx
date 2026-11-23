"use client";

import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import {
  SidebarProvider,
} from "@/components/layout/SidebarContext";

import PortfolioStats from "@/components/portfolio/PortfolioStats";
import PortfolioTable from "@/components/portfolio/PortfolioTable";

import {
  exportBetLogCsv,
  loadBetLog,
  makeBetId,
  saveBetLog,
  type PortfolioBet,
} from "@/lib/betLog";


// ==================================================
// CONSTANTS
// ==================================================

const BETFAIR_COMMISSION = 0.06;


// ==================================================
// PAGE
// ==================================================

export default function PortfolioPage() {
  const [bets, setBets] =
    useState<PortfolioBet[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  const [addBetOpen, setAddBetOpen] =
    useState(false);

  const [
    manualBetType,
    setManualBetType,
  ] = useState<
    "back_lay" | "cross_book"
  >("back_lay");


  // ==================================================
  // COMMON MANUAL FIELDS
  // ==================================================

  const [match, setMatch] =
    useState("");


  // ==================================================
  // BACK / LAY FIELDS
  // ==================================================

  const [
    selection,
    setSelection,
  ] = useState("");

  const [
    bookmaker,
    setBookmaker,
  ] = useState("");

  const [
    backOdds,
    setBackOdds,
  ] = useState("");

  const [
    layOdds,
    setLayOdds,
  ] = useState("");

  const [
    backStake,
    setBackStake,
  ] = useState("");

  const [
    layStake,
    setLayStake,
  ] = useState("");


  // ==================================================
  // CROSS BOOK - LEG 1
  // ==================================================

  const [
    leg1Selection,
    setLeg1Selection,
  ] = useState("");

  const [
    leg1Bookmaker,
    setLeg1Bookmaker,
  ] = useState("");

  const [
    leg1Odds,
    setLeg1Odds,
  ] = useState("");

  const [
    leg1Stake,
    setLeg1Stake,
  ] = useState("");


  // ==================================================
  // CROSS BOOK - LEG 2
  // ==================================================

  const [
    leg2Selection,
    setLeg2Selection,
  ] = useState("");

  const [
    leg2Bookmaker,
    setLeg2Bookmaker,
  ] = useState("");

  const [
    leg2Odds,
    setLeg2Odds,
  ] = useState("");

  const [
    leg2Stake,
    setLeg2Stake,
  ] = useState("");


  // ==================================================
  // LOAD PORTFOLIO
  // ==================================================

  useEffect(() => {
    setBets(
      loadBetLog()
    );

    setLoaded(true);
  }, []);


  // ==================================================
  // SAVE PORTFOLIO
  // ==================================================

  useEffect(() => {
    if (!loaded) {
      return;
    }

    saveBetLog(
      bets
    );
  }, [
    bets,
    loaded,
  ]);


  function updateBets(
    updated: PortfolioBet[]
  ) {
    setBets(
      updated
    );
  }


  // ==================================================
  // NUMBER HELPERS
  // ==================================================

  function toNumber(
    value: string
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }


  // ==================================================
  // BACK / LAY CALCULATIONS
  // ==================================================

  const backOddsNumber =
    toNumber(backOdds);

  const layOddsNumber =
    toNumber(layOdds);

  const backStakeNumber =
    toNumber(backStake);

  const layStakeNumber =
    toNumber(layStake);


  // Betfair liability:
  //
  // Lay Stake × (Lay Odds - 1)

  const backLayLiability =
    layStakeNumber > 0 &&
      layOddsNumber > 1
      ? layStakeNumber *
      (layOddsNumber - 1)
      : 0;


  // If BACK selection wins:
  //
  // Bookmaker profit =
  // Back Stake × (Back Odds - 1)
  //
  // Minus Betfair liability.

  const profitIfBackWins =
    backStakeNumber > 0 &&
      backOddsNumber > 1
      ? (
        backStakeNumber *
        (backOddsNumber - 1)
      ) -
      backLayLiability
      : 0;


  // If BACK selection loses:
  //
  // Betfair lay stake wins,
  // minus 6% Betfair commission,
  // minus bookmaker stake.

  const profitIfLayWins =
    layStakeNumber > 0
      ? (
        layStakeNumber *
        (1 - BETFAIR_COMMISSION)
      ) -
      backStakeNumber
      : 0;


  // Guaranteed profit is the lower
  // of the two possible outcomes.

  const backLayExpectedProfit =
    backStakeNumber > 0 &&
      layStakeNumber > 0 &&
      backOddsNumber > 1 &&
      layOddsNumber > 1
      ? Math.min(
        profitIfBackWins,
        profitIfLayWins
      )
      : 0;


  const backLayCapital =
    backStakeNumber +
    backLayLiability;


  const backLayRoi =
    backLayCapital > 0
      ? (
        backLayExpectedProfit /
        backLayCapital
      ) * 100
      : 0;


  // ==================================================
  // CROSS BOOK CALCULATIONS
  // ==================================================

  const leg1OddsNumber =
    toNumber(leg1Odds);

  const leg1StakeNumber =
    toNumber(leg1Stake);

  const leg2OddsNumber =
    toNumber(leg2Odds);

  const leg2StakeNumber =
    toNumber(leg2Stake);


  const leg1Payout =
    leg1OddsNumber > 0 &&
      leg1StakeNumber > 0
      ? leg1OddsNumber *
      leg1StakeNumber
      : 0;


  const leg2Payout =
    leg2OddsNumber > 0 &&
      leg2StakeNumber > 0
      ? leg2OddsNumber *
      leg2StakeNumber
      : 0;


  const crossBookTotalStake =
    leg1StakeNumber +
    leg2StakeNumber;


  // Guaranteed profit is based on
  // the LOWEST possible payout.

  const crossBookExpectedProfit =
    leg1Payout > 0 &&
      leg2Payout > 0
      ? Math.min(
        leg1Payout,
        leg2Payout
      ) -
      crossBookTotalStake
      : 0;


  const crossBookRoi =
    crossBookTotalStake > 0
      ? (
        crossBookExpectedProfit /
        crossBookTotalStake
      ) * 100
      : 0;


  // ==================================================
  // RESET MANUAL FORM
  // ==================================================

  function resetManualForm() {
    setManualBetType(
      "back_lay"
    );

    setMatch("");

    setSelection("");
    setBookmaker("");
    setBackOdds("");
    setLayOdds("");
    setBackStake("");
    setLayStake("");

    setLeg1Selection("");
    setLeg1Bookmaker("");
    setLeg1Odds("");
    setLeg1Stake("");

    setLeg2Selection("");
    setLeg2Bookmaker("");
    setLeg2Odds("");
    setLeg2Stake("");
  }


  function closeAddBet() {
    setAddBetOpen(false);
    resetManualForm();
  }


  // ==================================================
  // ADD MANUAL BET
  // ==================================================

  function addManualBet(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanMatch =
      match.trim();

    if (!cleanMatch) {
      return;
    }


    // ==================================================
    // CROSS BOOK
    // ==================================================

    if (
      manualBetType ===
      "cross_book"
    ) {
      const cleanLeg1Selection =
        leg1Selection.trim();

      const cleanLeg1Bookmaker =
        leg1Bookmaker.trim();

      const cleanLeg2Selection =
        leg2Selection.trim();

      const cleanLeg2Bookmaker =
        leg2Bookmaker.trim();


      if (
        !cleanLeg1Selection ||
        !cleanLeg1Bookmaker ||
        !cleanLeg2Selection ||
        !cleanLeg2Bookmaker ||
        leg1OddsNumber <= 1 ||
        leg2OddsNumber <= 1 ||
        leg1StakeNumber <= 0 ||
        leg2StakeNumber <= 0
      ) {
        return;
      }


      const newBet:
        PortfolioBet = {
        id: makeBetId(),

        event:
          cleanMatch,

        selection:
          `${cleanLeg1Selection} / ${cleanLeg2Selection}`,

        bookmaker:
          `${cleanLeg1Bookmaker} / ${cleanLeg2Bookmaker}`,

        exchange:
          "Multiple Bookmakers",

        type:
          "CROSS_BOOK_ARBITRAGE",

        legs: [
          {
            selection:
              cleanLeg1Selection,

            bookmaker:
              cleanLeg1Bookmaker,

            odds:
              leg1OddsNumber,

            stake:
              leg1StakeNumber,

            payout_if_wins:
              leg1Payout,

            link:
              null,
          },

          {
            selection:
              cleanLeg2Selection,

            bookmaker:
              cleanLeg2Bookmaker,

            odds:
              leg2OddsNumber,

            stake:
              leg2StakeNumber,

            payout_if_wins:
              leg2Payout,

            link:
              null,
          },
        ],

        // Compatibility fields.
        back_odds:
          leg1OddsNumber,

        lay_odds:
          leg2OddsNumber,

        commission:
          0,

        profit_percentage:
          crossBookRoi,

        guaranteed_profit:
          crossBookExpectedProfit,

        stake_plan: {
          bookmaker_stake:
            leg1StakeNumber,

          betfair_lay_stake:
            leg2StakeNumber,

          lay_liability:
            0,

          total_capital_required:
            crossBookTotalStake,
        },

        status:
          "open",

        result:
          null,

        settled_profit:
          null,

        clv:
          null,

        placed_at:
          new Date()
            .toISOString(),

        start_time:
          null,

        notes:
          "",
      };


      setBets([
        newBet,
        ...bets,
      ]);

      closeAddBet();

      return;
    }


    // ==================================================
    // BACK / LAY
    // ==================================================

    const cleanSelection =
      selection.trim();

    const cleanBookmaker =
      bookmaker.trim();


    if (
      !cleanSelection ||
      !cleanBookmaker ||
      backOddsNumber <= 1 ||
      layOddsNumber <= 1 ||
      backStakeNumber <= 0 ||
      layStakeNumber <= 0
    ) {
      return;
    }


    const newBet:
      PortfolioBet = {
      id:
        makeBetId(),

      event:
        cleanMatch,

      selection:
        cleanSelection,

      bookmaker:
        cleanBookmaker,

      exchange:
        "Betfair",

      type:
        "BACK_LAY_ARBITRAGE",

      legs:
        null,

      back_odds:
        backOddsNumber,

      lay_odds:
        layOddsNumber,

      commission:
        BETFAIR_COMMISSION,

      profit_percentage:
        backLayRoi,

      guaranteed_profit:
        backLayExpectedProfit,

      stake_plan: {
        bookmaker_stake:
          backStakeNumber,

        betfair_lay_stake:
          layStakeNumber,

        lay_liability:
          backLayLiability,

        total_capital_required:
          backLayCapital,
      },

      status:
        "open",

      result:
        null,

      settled_profit:
        null,

      clv:
        null,

      placed_at:
        new Date()
          .toISOString(),

      start_time:
        null,

      notes:
        "",
    };


    setBets([
      newBet,
      ...bets,
    ]);

    closeAddBet();
  }


  // ==================================================
  // LOADING
  // ==================================================

  if (!loaded) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen bg-slate-50">

          <Sidebar />

          <div className="flex-1">
            <Navbar />

            <main className="p-8">
              Loading portfolio...
            </main>
          </div>

        </div>
      </SidebarProvider>
    );
  }


  // ==================================================
  // PAGE
  // ==================================================

  return (
    <SidebarProvider>

      <div className="flex min-h-screen bg-slate-50">

        <Sidebar />

        <div className="flex-1 min-w-0">

          <Navbar />

          <main className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">

            {/* ==========================================
                PAGE HEADER
            ========================================== */}

            <div className="
              flex
              flex-col
              lg:flex-row
              lg:items-end
              justify-between
              gap-5
            ">

              <div>

                <p className="
                  text-sm
                  font-semibold
                  text-green-600
                  uppercase
                  tracking-widest
                ">
                  Portfolio
                </p>

                <h1 className="
                  text-3xl
                  md:text-4xl
                  font-bold
                  text-slate-900
                  mt-2
                ">
                  Bet & Profit Log
                </h1>

                <p className="
                  text-slate-500
                  mt-2
                ">
                  Track open positions,
                  exposure and settled
                  arbitrage performance.
                </p>

              </div>


              <div className="
                flex
                flex-wrap
                gap-3
              ">

                <button
                  disabled
                  className="
                    border
                    border-slate-300
                    bg-white
                    text-slate-400
                    px-4
                    py-2.5
                    rounded-xl
                    text-sm
                    font-semibold
                    cursor-not-allowed
                  "
                >
                  Auto-settle
                </button>


                <button
                  onClick={() =>
                    exportBetLogCsv(
                      bets
                    )
                  }
                  disabled={
                    bets.length === 0
                  }
                  className="
                    border
                    border-slate-300
                    bg-white
                    hover:bg-slate-50
                    disabled:opacity-40
                    text-slate-700
                    px-4
                    py-2.5
                    rounded-xl
                    text-sm
                    font-semibold
                  "
                >
                  Export CSV
                </button>


                <button
                  onClick={() =>
                    setAddBetOpen(
                      true
                    )
                  }
                  className="
                    bg-green-500
                    hover:bg-green-600
                    text-white
                    px-5
                    py-2.5
                    rounded-xl
                    text-sm
                    font-semibold
                    shadow-sm
                  "
                >
                  + Add Bet
                </button>

              </div>

            </div>


            <PortfolioStats
              bets={bets}
            />


            <PortfolioTable
              bets={bets}
              setBets={updateBets}
            />

          </main>

        </div>


        {/* ==========================================
            ADD BET MODAL
        ========================================== */}

        {addBetOpen && (

          <div className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            p-4
          ">

            {/* BACKDROP */}

            <div
              onClick={
                closeAddBet
              }
              className="
                absolute
                inset-0
                bg-slate-950/50
                backdrop-blur-sm
              "
            />


            {/* FORM */}

            <form
              onSubmit={
                addManualBet
              }
              className="
                relative
                bg-white
                rounded-2xl
                shadow-2xl
                w-full
                max-w-xl
                max-h-[90vh]
                overflow-y-auto
                p-6
              "
            >

              {/* HEADER */}

              <div className="
                flex
                justify-between
                items-start
              ">

                <div>

                  <p className="
                    text-sm
                    text-green-600
                    font-semibold
                  ">
                    Portfolio
                  </p>

                  <h2 className="
                    text-2xl
                    font-bold
                    mt-1
                  ">
                    Add Bet
                  </h2>

                </div>


                <button
                  type="button"
                  onClick={
                    closeAddBet
                  }
                  className="
                    text-slate-400
                    hover:text-slate-900
                    text-xl
                  "
                >
                  ✕
                </button>

              </div>


              <div className="
                space-y-5
                mt-6
              ">

                {/* ======================================
                    BET TYPE
                ====================================== */}

                <div>

                  <label className="
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                    mb-2
                  ">
                    Bet Type
                  </label>


                  <select
                    value={
                      manualBetType
                    }
                    onChange={(event) =>
                      setManualBetType(
                        event.target.value as
                        | "back_lay"
                        | "cross_book"
                      )
                    }
                    className="
                      w-full
                      border
                      border-slate-300
                      rounded-xl
                      px-4
                      py-3
                      outline-none
                      focus:ring-2
                      focus:ring-green-500
                      bg-white
                    "
                  >

                    <option value="back_lay">
                      Back / Lay
                    </option>

                    <option value="cross_book">
                      Cross Book
                    </option>

                  </select>

                </div>


                {/* ======================================
                    MATCH
                ====================================== */}

                <Input
                  label="Match"
                  value={match}
                  onChange={
                    setMatch
                  }
                  placeholder="PSG vs Aston Villa"
                  required
                />


                {/* ======================================
                    BACK / LAY
                ====================================== */}

                {manualBetType ===
                  "back_lay" ? (

                  <>

                    <Input
                      label="Selection to Back / Lay"
                      value={selection}
                      onChange={
                        setSelection
                      }
                      placeholder="PSG"
                      required
                    />


                    <Input
                      label="Back Bookmaker"
                      value={bookmaker}
                      onChange={
                        setBookmaker
                      }
                      placeholder="Sportsbet"
                      required
                    />


                    <div className="
                      grid
                      grid-cols-1
                      sm:grid-cols-2
                      gap-4
                    ">

                      <Input
                        label="Back odds"
                        value={backOdds}
                        onChange={
                          setBackOdds
                        }
                        type="number"
                        step="0.01"
                        min="1.01"
                        required
                      />

                      <Input
                        label="Betfair Lay odds"
                        value={layOdds}
                        onChange={
                          setLayOdds
                        }
                        type="number"
                        step="0.01"
                        min="1.01"
                        required
                      />

                    </div>


                    <div className="
                      grid
                      grid-cols-1
                      sm:grid-cols-2
                      gap-4
                    ">

                      <Input
                        label="Back stake"
                        value={backStake}
                        onChange={
                          setBackStake
                        }
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                      />

                      <Input
                        label="Lay stake"
                        value={layStake}
                        onChange={
                          setLayStake
                        }
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                      />

                    </div>


                    {/* CALCULATED RESULTS */}

                    <div className="
                      rounded-xl
                      border
                      border-slate-200
                      bg-slate-50
                      p-4
                      space-y-3
                    ">

                      <div className="
                        flex
                        justify-between
                        items-center
                        gap-3
                      ">

                        <span className="
                          text-sm
                          text-slate-600
                        ">
                          Betfair commission
                        </span>

                        <span className="
                          font-semibold
                          text-slate-900
                        ">
                          6%
                        </span>

                      </div>


                      <ResultRow
                        label="Liability"
                        value={
                          `$${backLayLiability.toFixed(2)}`
                        }
                      />


                      <ResultRow
                        label="Profit if selection wins"
                        value={
                          formatMoney(
                            profitIfBackWins
                          )
                        }
                        positive={
                          profitIfBackWins >= 0
                        }
                      />


                      <ResultRow
                        label="Profit if selection loses"
                        value={
                          formatMoney(
                            profitIfLayWins
                          )
                        }
                        positive={
                          profitIfLayWins >= 0
                        }
                      />


                      <div className="
                        border-t
                        border-slate-200
                        pt-3
                      ">

                        <ResultRow
                          label="Expected guaranteed profit"
                          value={
                            formatMoney(
                              backLayExpectedProfit
                            )
                          }
                          positive={
                            backLayExpectedProfit >= 0
                          }
                          strong
                        />

                      </div>


                      <ResultRow
                        label="ROI"
                        value={
                          `${backLayRoi >= 0 ? "+" : ""}${backLayRoi.toFixed(2)}%`
                        }
                        positive={
                          backLayRoi >= 0
                        }
                      />

                    </div>

                  </>

                ) : (

                  /* ======================================
                      CROSS BOOK
                  ====================================== */

                  <>

                    {/* BOOKMAKER 1 */}

                    <div className="
                      rounded-xl
                      border
                      border-slate-200
                      p-4
                      space-y-4
                    ">

                      <p className="
                        font-bold
                        text-slate-900
                      ">
                        Bookmaker 1
                      </p>


                      <Input
                        label="Selection"
                        value={
                          leg1Selection
                        }
                        onChange={
                          setLeg1Selection
                        }
                        placeholder="New Zealand Warriors"
                        required
                      />


                      <Input
                        label="Bookmaker"
                        value={
                          leg1Bookmaker
                        }
                        onChange={
                          setLeg1Bookmaker
                        }
                        placeholder="TAB"
                        required
                      />


                      <div className="
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        gap-4
                      ">

                        <Input
                          label="Odds"
                          value={
                            leg1Odds
                          }
                          onChange={
                            setLeg1Odds
                          }
                          type="number"
                          step="0.01"
                          min="1.01"
                          required
                        />

                        <Input
                          label="Stake"
                          value={
                            leg1Stake
                          }
                          onChange={
                            setLeg1Stake
                          }
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                        />

                      </div>


                      <ResultRow
                        label="Payout"
                        value={
                          `$${leg1Payout.toFixed(2)}`
                        }
                      />

                    </div>


                    {/* BOOKMAKER 2 */}

                    <div className="
                      rounded-xl
                      border
                      border-slate-200
                      p-4
                      space-y-4
                    ">

                      <p className="
                        font-bold
                        text-slate-900
                      ">
                        Bookmaker 2
                      </p>


                      <Input
                        label="Selection"
                        value={
                          leg2Selection
                        }
                        onChange={
                          setLeg2Selection
                        }
                        placeholder="Manly Warringah Sea Eagles"
                        required
                      />


                      <Input
                        label="Bookmaker"
                        value={
                          leg2Bookmaker
                        }
                        onChange={
                          setLeg2Bookmaker
                        }
                        placeholder="TABtouch"
                        required
                      />


                      <div className="
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        gap-4
                      ">

                        <Input
                          label="Odds"
                          value={
                            leg2Odds
                          }
                          onChange={
                            setLeg2Odds
                          }
                          type="number"
                          step="0.01"
                          min="1.01"
                          required
                        />

                        <Input
                          label="Stake"
                          value={
                            leg2Stake
                          }
                          onChange={
                            setLeg2Stake
                          }
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                        />

                      </div>


                      <ResultRow
                        label="Payout"
                        value={
                          `$${leg2Payout.toFixed(2)}`
                        }
                      />

                    </div>


                    {/* CROSS BOOK CALCULATION */}

                    <div className="
                      rounded-xl
                      border
                      border-slate-200
                      bg-slate-50
                      p-4
                      space-y-3
                    ">

                      <ResultRow
                        label="Total stake"
                        value={
                          `$${crossBookTotalStake.toFixed(2)}`
                        }
                      />


                      <ResultRow
                        label="Lowest payout"
                        value={
                          `$${Math.min(
                            leg1Payout || 0,
                            leg2Payout || 0
                          ).toFixed(2)}`
                        }
                      />


                      <div className="
                        border-t
                        border-slate-200
                        pt-3
                      ">

                        <ResultRow
                          label="Expected guaranteed profit"
                          value={
                            formatMoney(
                              crossBookExpectedProfit
                            )
                          }
                          positive={
                            crossBookExpectedProfit >= 0
                          }
                          strong
                        />

                      </div>


                      <ResultRow
                        label="ROI"
                        value={
                          `${crossBookRoi >= 0 ? "+" : ""}${crossBookRoi.toFixed(2)}%`
                        }
                        positive={
                          crossBookRoi >= 0
                        }
                      />

                    </div>

                  </>

                )}

              </div>


              {/* SUBMIT */}

              <button
                type="submit"
                className="
                  w-full
                  mt-6
                  bg-green-500
                  hover:bg-green-600
                  text-white
                  rounded-xl
                  py-3
                  font-semibold
                "
              >
                Add to Portfolio
              </button>

            </form>

          </div>

        )}

      </div>

    </SidebarProvider>
  );
}


// ==================================================
// MONEY FORMAT
// ==================================================

function formatMoney(
  value: number
) {
  const prefix =
    value >= 0
      ? "+"
      : "-";

  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}


// ==================================================
// RESULT ROW
// ==================================================

function ResultRow({
  label,
  value,
  positive,
  strong = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="
      flex
      items-center
      justify-between
      gap-4
    ">

      <span className="
        text-sm
        text-slate-600
      ">
        {label}
      </span>

      <span
        className={`
          ${strong
            ? "font-bold text-base"
            : "font-semibold text-sm"
          }

          ${positive === undefined
            ? "text-slate-900"
            : positive
              ? "text-green-600"
              : "text-red-600"
          }
        `}
      >
        {value}
      </span>

    </div>
  );
}


// ==================================================
// INPUT
// ==================================================

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <div>

      <label className="
        block
        text-sm
        font-semibold
        text-slate-700
        mb-2
      ">
        {label}
      </label>


      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        type={type}
        step={step}
        min={min}
        placeholder={placeholder}
        required={required}
        className="
          w-full
          border
          border-slate-300
          rounded-xl
          px-4
          py-3
          outline-none
          focus:ring-2
          focus:ring-green-500
          bg-white
        "
      />

    </div>
  );
}