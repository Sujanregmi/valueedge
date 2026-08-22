"use client";

import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import PortfolioStats from "@/components/portfolio/PortfolioStats";
import PortfolioTable from "@/components/portfolio/PortfolioTable";

import {
  exportBetLogCsv,
  loadBetLog,
  makeBetId,
  saveBetLog,
  type PortfolioBet,
} from "@/lib/betLog";


export default function PortfolioPage() {
  const [bets, setBets] =
    useState<PortfolioBet[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  const [addBetOpen, setAddBetOpen] =
    useState(false);


  useEffect(() => {
    setBets(
      loadBetLog()
    );

    setLoaded(true);
  }, []);


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


  function addManualBet(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    const match =
      String(
        form.get("event") ?? ""
      ).trim();

    const selection =
      String(
        form.get("selection") ?? ""
      ).trim();

    const bookmaker =
      String(
        form.get("bookmaker") ?? ""
      ).trim();

    const backOdds =
      Number(
        form.get("back_odds")
      );

    const layOdds =
      Number(
        form.get("lay_odds")
      );

    const backStake =
      Number(
        form.get("back_stake")
      );

    const layStake =
      Number(
        form.get("lay_stake")
      );

    const liability =
      Number(
        form.get("liability")
      );

    const expectedProfit =
      Number(
        form.get("expected_profit")
      );


    if (
      !match ||
      !selection ||
      !bookmaker
    ) {
      return;
    }


    const roi =
      backStake > 0
        ? (
            expectedProfit /
            backStake
          ) * 100
        : 0;


    const newBet:
      PortfolioBet = {
        id: makeBetId(),

        event: match,
        selection,
        bookmaker,

        exchange:
          "Betfair",

        type:
          "back_lay_arbitrage",

        back_odds:
          backOdds || 0,

        lay_odds:
          layOdds || 0,

        commission:
          0.05,

        profit_percentage:
          roi,

        guaranteed_profit:
          expectedProfit || 0,

        stake_plan: {
          bookmaker_stake:
            backStake || 0,

          betfair_lay_stake:
            layStake || 0,

          lay_liability:
            liability || 0,

          total_capital_required:
            (
              backStake || 0
            ) +
            (
              liability || 0
            ),
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
          new Date().toISOString(),

        start_time:
          null,

        notes:
          "",
      };


    setBets([
      newBet,
      ...bets,
    ]);

    setAddBetOpen(false);
  }


  if (!loaded) {
    return (
      <div className="flex min-h-screen bg-slate-50">

        <Sidebar />

        <div className="flex-1">
          <Navbar />

          <main className="p-8">
            Loading portfolio...
          </main>
        </div>

      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar />

      <div className="flex-1 min-w-0">

        <Navbar />

        <main className="
          max-w-[1600px]
          mx-auto
          p-6
          md:p-8
          space-y-8
        ">

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
                  setAddBetOpen(true)
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

          <div
            onClick={() =>
              setAddBetOpen(false)
            }
            className="
              absolute
              inset-0
              bg-slate-950/50
              backdrop-blur-sm
            "
          />

          <form
            onSubmit={addManualBet}
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
                onClick={() =>
                  setAddBetOpen(false)
                }
                className="
                  text-slate-400
                  hover:text-slate-900
                "
              >
                ✕
              </button>

            </div>


            <div className="
              space-y-4
              mt-6
            ">

              <Input
                label="Match"
                name="event"
                placeholder="PSG vs Aston Villa"
              />

              <Input
                label="Selection"
                name="selection"
                placeholder="PSG"
              />

              <Input
                label="Bookmaker"
                name="bookmaker"
                placeholder="Sportsbet"
              />

              <div className="
                grid
                grid-cols-2
                gap-4
              ">
                <Input
                  label="Back odds"
                  name="back_odds"
                  type="number"
                  step="0.01"
                />

                <Input
                  label="Lay odds"
                  name="lay_odds"
                  type="number"
                  step="0.01"
                />
              </div>

              <div className="
                grid
                grid-cols-2
                gap-4
              ">
                <Input
                  label="Back stake"
                  name="back_stake"
                  type="number"
                  step="0.01"
                />

                <Input
                  label="Lay stake"
                  name="lay_stake"
                  type="number"
                  step="0.01"
                />
              </div>

              <div className="
                grid
                grid-cols-2
                gap-4
              ">
                <Input
                  label="Liability"
                  name="liability"
                  type="number"
                  step="0.01"
                />

                <Input
                  label="Expected profit"
                  name="expected_profit"
                  type="number"
                  step="0.01"
                />
              </div>

            </div>


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
  );
}


function Input({
  label,
  name,
  placeholder,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  step?: string;
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
        name={name}
        type={type}
        step={step}
        placeholder={placeholder}
        required
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
        "
      />

    </div>
  );
}