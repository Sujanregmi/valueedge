"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

import { loadBetLog, saveBetLog, type PortfolioBet } from "@/lib/betLog";

// --------------------------------------------------
// Starting bankroll: no backend endpoint exists for this yet (the
// Bankroll model in models.py has no router wired to it), so it's
// stored locally for now, the same way portfolio bets already are.
// Move both to a real /bankroll API once that router exists --
// this key is deliberately separate from betLog's storage key so
// migrating later is a clean swap, not an untangling job.
// --------------------------------------------------
type BankrollData = {
  id: number | null;
  user_id: number;
  balance: number;
};


const API_URL = "http://127.0.0.1:8000";

export default function BankrollPage() {
  const [bets, setBets] = useState<PortfolioBet[]>([]);
  const [startingBankroll, setStartingBankrollState] =
    useState(0);

  const [editingBankroll, setEditingBankroll] =
    useState(false);

  const [bankrollInput, setBankrollInput] =
    useState("0");

  const [bankrollLoading, setBankrollLoading] =
    useState(true);

  const [bankrollSaving, setBankrollSaving] =
    useState(false);

  const [bankrollError, setBankrollError] =
    useState<string | null>(null);

  async function loadBankroll() {
    try {
      setBankrollLoading(true);
      setBankrollError(null);

      const res = await fetch(
        `${API_URL}/bankroll`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (res.status === 401) {
        throw new Error(
          "Session expired — please log in again."
        );
      }

      if (!res.ok) {
        throw new Error(
          `Unable to load bankroll: ${res.status}`
        );
      }

      const data: BankrollData =
        await res.json();

      const balance =
        Number(data.balance) || 0;

      setStartingBankrollState(balance);
      setBankrollInput(balance.toString());
    } catch (err) {
      setBankrollError(
        err instanceof Error
          ? err.message
          : "Unable to load bankroll"
      );
    } finally {
      setBankrollLoading(false);
    }
  }



  useEffect(() => {
    setBets(loadBetLog());
    loadBankroll();
  }, []);
  function updateBets(updated: PortfolioBet[]) {
    setBets(updated);
    saveBetLog(updated);
  }

  async function commitBankroll() {
    const value = Number(bankrollInput);

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      setBankrollInput(
        startingBankroll.toString()
      );

      setBankrollError(
        "Enter a valid bankroll amount."
      );

      return;
    }

    try {
      setBankrollSaving(true);
      setBankrollError(null);

      const res = await fetch(
        `${API_URL}/bankroll`,
        {
          method: "PATCH",
          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            balance: value,
          }),
        }
      );

      if (res.status === 401) {
        throw new Error(
          "Session expired — please log in again."
        );
      }

      if (!res.ok) {
        const data =
          await res.json().catch(() => null);

        throw new Error(
          data?.detail ??
          `Unable to save bankroll: ${res.status}`
        );
      }

      const data: BankrollData =
        await res.json();

      const savedBalance =
        Number(data.balance) || 0;

      setStartingBankrollState(
        savedBalance
      );

      setBankrollInput(
        savedBalance.toString()
      );

      setEditingBankroll(false);
    } catch (err) {
      setBankrollError(
        err instanceof Error
          ? err.message
          : "Unable to save bankroll"
      );
    } finally {
      setBankrollSaving(false);
    }
  }

  // ==================================================
  // DERIVED STATS -- all computed from real logged bets,
  // nothing hardcoded.
  // ==================================================

  const stats = useMemo(() => {
    const settled = bets.filter(
      (b) => b.status === "settled" || b.status === "void"
    );
    const open = bets.filter((b) => b.status === "open");

    const realizedProfit = settled.reduce(
      (sum, b) => sum + (b.settled_profit ?? 0),
      0
    );

    const totalStaked = bets.reduce(
      (sum, b) => sum + b.stake_plan.bookmaker_stake,
      0
    );

    const settledStaked = settled.reduce(
      (sum, b) => sum + b.stake_plan.bookmaker_stake,
      0
    );

    const roi = settledStaked > 0 ? (realizedProfit / settledStaked) * 100 : 0;

    const avgBetSize =
      bets.length > 0 ? totalStaked / bets.length : 0;

    const wins = settled.filter((b) => (b.settled_profit ?? 0) > 0).length;
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;

    // Equity curve + max drawdown. Approximated from placed_at order
    // since settlement timestamps aren't tracked yet -- accurate
    // once bets settle roughly in the order they were placed, which
    // is the common case for arbitrage (short-lived events).
    const chronological = [...settled].sort(
      (a, b) =>
        new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
    );

    let running = startingBankroll;
    let peak = startingBankroll;
    let maxDrawdownPct = 0;

    for (const bet of chronological) {
      running += bet.settled_profit ?? 0;
      peak = Math.max(peak, running);
      if (peak > 0) {
        const drawdown = ((peak - running) / peak) * 100;
        maxDrawdownPct = Math.max(maxDrawdownPct, drawdown);
      }
    }

    const currentBalance = startingBankroll + realizedProfit;

    const unrealizedPotential = open.reduce(
      (sum, b) => sum + b.guaranteed_profit,
      0
    );

    return {
      currentBalance,
      realizedProfit,
      roi,
      avgBetSize,
      winRate,
      maxDrawdownPct,
      openCount: open.length,
      settledCount: settled.length,
      unrealizedPotential,
    };
  }, [bets, startingBankroll]);

  function settleBet(id: string, outcome: "won" | "void") {
    const updated = bets.map((bet) => {
      if (bet.id !== id) return bet;
      return {
        ...bet,
        status: "settled" as const,
        result: outcome,
        settled_profit: outcome === "won" ? bet.guaranteed_profit : 0,
      };
    });
    updateBets(updated);
  }

  function reopenBet(id: string) {
    const updated = bets.map((bet) =>
      bet.id === id
        ? { ...bet, status: "open" as const, result: null, settled_profit: null }
        : bet
    );
    updateBets(updated);
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Navbar />

          <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {/* HEADER */}
            <div className="mb-8">
              <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
                Performance
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1 sm:text-3xl">
                Bankroll Management
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                Track your betting performance and manage risk. Figures
                below are calculated from bets you&apos;ve logged from the
                Arbitrage scanner.
              </p>
            </div>

            {/* TOP CARDS */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {bankrollError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {bankrollError}
                </div>
              )}
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between">
                  <p className="text-gray-500">Current balance</p>
                  <button
                    type="button"
                    onClick={() => setEditingBankroll(true)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Edit starting bankroll
                  </button>
                </div>

                {editingBankroll ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={bankrollInput}
                      onChange={(e) => setBankrollInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && commitBankroll()}
                      autoFocus
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold font-mono"
                    />
                    <button
                      type="button"
                      onClick={commitBankroll}
                      disabled={bankrollSaving}
                      className="
    text-sm
    font-semibold
    text-green-600
    hover:text-green-700
    disabled:text-gray-400
    disabled:cursor-not-allowed
  "
                    >
                      {bankrollSaving
                        ? "Saving…"
                        : "Save"}
                    </button>
                  </div>
                ) : (
                  <h2 className="text-4xl font-bold mt-3 text-gray-900 font-mono">
                    {bankrollLoading
                      ? "Loading…"
                      : `$${stats.currentBalance.toFixed(2)}`}
                  </h2>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Started at ${startingBankroll.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-gray-500">Realized profit</p>
                <h2
                  className={`text-4xl font-bold mt-3 font-mono ${stats.realizedProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                >
                  {stats.realizedProfit >= 0 ? "+" : ""}
                  ${stats.realizedProfit.toFixed(2)}
                </h2>
                <p className="text-xs text-gray-400 mt-2">
                  From {stats.settledCount} settled bet
                  {stats.settledCount === 1 ? "" : "s"}
                  {stats.openCount > 0 &&
                    ` · $${stats.unrealizedPotential.toFixed(2)} pending in ${stats.openCount
                    } open`}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-gray-500">ROI</p>
                <h2 className="text-4xl font-bold mt-3 text-gray-900 font-mono">
                  {stats.roi.toFixed(2)}%
                </h2>
                <p className="text-xs text-gray-400 mt-2">
                  Realized profit ÷ staked on settled bets
                </p>
              </div>
            </div>

            {/* CALCULATOR + RISK OVERVIEW */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              <StakingCalculator />

              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Risk overview
                </h2>

                <div className="mt-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Average bet size</span>
                    <b className="font-mono">
                      ${stats.avgBetSize.toFixed(2)}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Win rate</span>
                    <b className="font-mono">
                      {stats.settledCount > 0
                        ? `${stats.winRate.toFixed(0)}%`
                        : "—"}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Largest drawdown</span>
                    <b className="font-mono text-red-600">
                      {stats.settledCount > 0
                        ? `-${stats.maxDrawdownPct.toFixed(1)}%`
                        : "—"}
                    </b>
                  </div>
                </div>

                {stats.settledCount === 0 && (
                  <p className="text-xs text-gray-400 mt-6">
                    Settle a few bets below to see real win rate and
                    drawdown figures instead of dashes.
                  </p>
                )}
              </div>
            </div>

            {/* BET HISTORY */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">
                  Bet history
                </h2>
              </div>

              {bets.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    No bets logged yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Log a bet from the Arbitrage scanner&apos;s
                    &ldquo;+&rdquo; button to see it here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-3 text-left font-medium">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Stake
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Expected profit
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Settled P&amp;L
                        </th>
                        <th className="px-4 py-3 text-center font-medium">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.map((bet) => (
                        <tr
                          key={bet.id}
                          className="border-b border-gray-50 hover:bg-gray-50/60"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">
                              {bet.event}
                            </p>
                            <p className="text-xs text-gray-500">
                              {bet.selection} · {bet.bookmaker}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-900">
                            ${bet.stake_plan.bookmaker_stake.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-green-600">
                            +${bet.guaranteed_profit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={bet.status} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {bet.status === "open" ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <span
                                className={
                                  (bet.settled_profit ?? 0) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {(bet.settled_profit ?? 0) >= 0 ? "+" : ""}
                                ${(bet.settled_profit ?? 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {bet.status === "open" ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => settleBet(bet.id, "won")}
                                  className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg"
                                >
                                  Settle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => settleBet(bet.id, "void")}
                                  className="text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg"
                                >
                                  Void
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => reopenBet(bet.id)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                              >
                                Reopen
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function StatusBadge({ status }: { status: PortfolioBet["status"] }) {
  if (status === "open") {
    return (
      <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
        OPEN
      </span>
    );
  }
  if (status === "void") {
    return (
      <span className="text-[10px] font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
        VOID
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
      SETTLED
    </span>
  );
}

// ==================================================
// STAKING CALCULATOR
// ==================================================
//
// Standard back/lay arbitrage formula, independent of any specific
// live opportunity -- lets you plug in odds manually. This uses the
// textbook formula (lay stake to cover the back stake at the given
// odds, minus exchange commission). It is NOT pulled from your
// backend's value_engine.calculate_back_lay_arbitrage, which I
// haven't seen -- cross-check a few outputs against that function
// to make sure commission is applied identically before trusting
// this for real stakes.

function StakingCalculator() {
  const [backOdds, setBackOdds] = useState("2.00");
  const [layOdds, setLayOdds] = useState("2.05");
  const [backStake, setBackStake] = useState("100");
  const [commissionPct, setCommissionPct] = useState("5");

  const backOddsNum = Number(backOdds);
  const layOddsNum = Number(layOdds);
  const backStakeNum = Number(backStake);
  const commission = Number(commissionPct) / 100;

  const valid =
    Number.isFinite(backOddsNum) &&
    backOddsNum > 1 &&
    Number.isFinite(layOddsNum) &&
    layOddsNum > 1 &&
    Number.isFinite(backStakeNum) &&
    backStakeNum > 0 &&
    Number.isFinite(commission) &&
    commission >= 0 &&
    commission < 1;

  let layStake = 0;
  let liability = 0;
  let profitIfBackWins = 0;
  let profitIfLayWins = 0;

  if (valid) {
    layStake = (backOddsNum * backStakeNum) / (layOddsNum - commission);
    liability = layStake * (layOddsNum - 1);
    profitIfBackWins = backStakeNum * (backOddsNum - 1) - liability;
    profitIfLayWins = layStake * (1 - commission) - backStakeNum;
  }

  const guaranteedProfit = valid
    ? Math.min(profitIfBackWins, profitIfLayWins)
    : 0;
  const roi =
    valid && backStakeNum + liability > 0
      ? (guaranteedProfit / (backStakeNum + liability)) * 100
      : 0;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-bold text-gray-900">Staking calculator</h2>
      <p className="text-xs text-gray-400 mt-1">
        Standard back/lay formula &mdash; verify against your backend before
        relying on it for real stakes.
      </p>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Field label="Back odds" value={backOdds} onChange={setBackOdds} />
        <Field label="Lay odds" value={layOdds} onChange={setLayOdds} />
        <Field
          label="Back stake ($)"
          value={backStake}
          onChange={setBackStake}
        />
        <Field
          label="Exchange commission (%)"
          value={commissionPct}
          onChange={setCommissionPct}
        />
      </div>

      {!valid ? (
        <p className="text-xs text-red-500 mt-4">
          Enter odds above 1.00 and a positive stake to calculate.
        </p>
      ) : (
        <div className="mt-5 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden text-sm">
          <Row label="Required lay stake" value={`$${layStake.toFixed(2)}`} />
          <Row label="Lay liability" value={`$${liability.toFixed(2)}`} />
          <Row
            label="Total capital required"
            value={`$${(backStakeNum + liability).toFixed(2)}`}
          />
          <Row
            label="Guaranteed profit"
            value={`${guaranteedProfit >= 0 ? "+" : ""}$${guaranteedProfit.toFixed(
              2
            )}`}
            valueClass={guaranteedProfit >= 0 ? "text-green-600" : "text-red-600"}
            bold
          />
          <Row label="ROI" value={`${roi.toFixed(2)}%`} noBorder />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
      />
    </label>
  );
}

function Row({
  label,
  value,
  valueClass = "text-gray-900",
  bold = false,
  noBorder = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center px-4 py-2.5 ${noBorder ? "" : "border-b border-gray-100"
        }`}
    >
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}