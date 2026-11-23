"use client";

import { useMemo, useState } from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import OddsTable, { type ArbitrageBet } from "@/components/valuebets/OddsTable";

type ScanStatus = "idle" | "scanning" | "complete" | "error";

export default function ArbitragePage() {
  const [bets, setBets] = useState<ArbitrageBet[]>([]);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedBet, setSelectedBet] = useState<ArbitrageBet | null>(null);

  const stats = useMemo(() => {
    if (bets.length === 0) {
      return {
        live: 0,
        bestRoi: 0,
        totalProfit: 0,
        avgEdge: 0,
      };
    }

    const totalProfit = bets.reduce((sum, b) => sum + b.guaranteed_profit, 0);
    const bestRoi = Math.max(...bets.map((b) => b.profit_percentage));
    const avgEdge =
      bets.reduce((sum, b) => sum + b.profit_percentage, 0) / bets.length;

    return {
      live: bets.length,
      bestRoi,
      totalProfit,
      avgEdge,
    };
  }, [bets]);

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-100 flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Navbar />

          <main className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">
            {/* PAGE HEADER */}
            <div className="mb-8">
              <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
                Live market scanner
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1 sm:text-3xl">
                Arbitrage Scanner
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                Live bookmaker back odds compared against Betfair lay prices.
                Guaranteed profit opportunities appear here the moment the
                scanner finds an edge.
              </p>
            </div>

            {/* STAT STRIP */}
            <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4 sm:gap-4">
              <StatCard
                label="Live Opportunities"
                value={stats.live.toString()}
                tone={status === "scanning" ? "amber" : "green"}
                caption={status === "scanning" ? "scanning…" : "on the board"}
              />
              <StatCard
                label="Best ROI"
                value={stats.live ? `+${stats.bestRoi.toFixed(2)}%` : "—"}
                tone="green"
                caption="top opportunity"
              />
              <StatCard
                label="Avg Edge"
                value={stats.live ? `+${stats.avgEdge.toFixed(2)}%` : "—"}
                tone="blue"
                caption="across live bets"
              />
              <StatCard
                label="Potential Profit"
                value={stats.live ? `$${stats.totalProfit.toFixed(2)}` : "—"}
                tone="green"
                caption="if all staked once"
              />
            </div>

            {/* TABLE */}
            <OddsTable
              selectBet={setSelectedBet}
              onOpportunitiesChange={(info: {
                bets: ArbitrageBet[];
                status: ScanStatus;
                lastUpdated: string | null;
              }) => {
                setBets(info.bets);
                setStatus(info.status);
                setLastUpdated(info.lastUpdated);
              }}
            />
          </main>
        </div>

        {/* DETAILS DRAWER */}
        {selectedBet && (
          <div className="fixed inset-0 z-[90] flex justify-end">
            <div
              onClick={() => setSelectedBet(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />

            <div className="relative w-full max-w-md h-full bg-white border-l border-gray-200 shadow-2xl overflow-y-auto">
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200 sticky top-0 bg-white">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold">
                    Opportunity Details
                  </p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    {selectedBet.event}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedBet.selection}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBet(null)}
                  className="text-gray-400 hover:text-gray-900 text-xl leading-none shrink-0"
                >
                  ✕
                </button>
              </div>
              {/*
  DETAILS DRAWER -- patch for app/value-bets/page.tsx

  Replace the existing drawer content (the BACK/LAY card grid and the
  DetailRow block below it) with this. The rest of the drawer --
  header, close button, outer wrapper -- stays exactly as you have it.

  Root cause: selectedBet.stake_plan.betfair_lay_stake (and
  lay_liability, total_capital_required) are null for cross-book
  bets, same as the crash you just hit in OddsTable.tsx. This guards
  every one of those fields the same way.
*/}

              <div className="p-6 space-y-6">

                {selectedBet.legs && selectedBet.legs.length > 0 ? (
                  // ================= CROSS-BOOK: show each leg =================
                  <div className="space-y-3">
                    {selectedBet.legs.map((leg, i) => (
                      <div
                        key={i}
                        className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-[10px] font-bold text-amber-700 font-mono tracking-wide">
                            LEG {i + 1}
                          </p>
                          <p className="font-bold text-gray-900 mt-1 text-sm">
                            {leg.bookmaker}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{leg.selection}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-700 font-mono">
                            {leg.odds}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            stake ${leg.stake.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // ================= BACK/LAY: existing layout =================
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-blue-700 font-mono tracking-wide">
                        BACK
                      </p>
                      <p className="font-bold text-gray-900 mt-2 text-sm">
                        {selectedBet.bookmaker}
                      </p>
                      <p className="text-3xl font-bold text-blue-700 mt-2 font-mono">
                        {selectedBet.back_odds}
                      </p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-rose-700 font-mono tracking-wide">
                        LAY
                      </p>
                      <p className="font-bold text-gray-900 mt-2 text-sm">
                        {selectedBet.exchange}
                      </p>
                      <p className="text-3xl font-bold text-rose-700 mt-2 font-mono">
                        {selectedBet.lay_odds}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-green-700">
                    Guaranteed profit
                  </span>
                  <span className="font-mono font-bold text-green-700 text-lg">
                    +${selectedBet.guaranteed_profit.toFixed(2)}
                  </span>
                </div>

                {/* Stake breakdown only applies to back/lay bets -- cross-book
      stakes are already shown per-leg above, no separate liability/
      total-capital breakdown needed since there's no exchange leg. */}
                {!(selectedBet.legs && selectedBet.legs.length > 0) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden font-mono text-sm">
                    <DetailRow
                      label="Back stake"
                      value={`$${selectedBet.stake_plan.bookmaker_stake.toFixed(2)}`}
                    />
                    <DetailRow
                      label="Betfair lay stake"
                      value={`$${selectedBet.stake_plan.betfair_lay_stake.toFixed(2)}`}
                      valueClass="text-rose-700"
                    />
                    <DetailRow
                      label="Lay liability"
                      value={`$${selectedBet.stake_plan.lay_liability.toFixed(2)}`}
                    />
                    <DetailRow
                      label="Total capital required"
                      value={`$${selectedBet.stake_plan.total_capital_required.toFixed(2)}`}
                    />
                    <DetailRow
                      label="Commission"
                      value={`${(selectedBet.commission * 100).toFixed(2)}%`}
                      noBorder
                    />
                  </div>
                )}

                <p className="text-xs text-gray-400 leading-relaxed">
                  Odds move fast — re-check {selectedBet.legs && selectedBet.legs.length > 0 ? "every leg" : "both legs"} on
                  {selectedBet.legs && selectedBet.legs.length > 0
                    ? " each bookmaker"
                    : " the bookmaker and exchange"}{" "}
                  before placing{selectedBet.legs && selectedBet.legs.length > 0 ? " any leg" : " either side"}.
                  {!(selectedBet.legs && selectedBet.legs.length > 0) && (
                    <>
                      {" "}Use the{" "}
                      <span className="font-semibold text-gray-600">＋</span> button
                      on the table to log this stake to your Portfolio.
                    </>
                  )}
                </p>

              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}

function StatCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "green" | "blue" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600"
      : tone === "blue"
        ? "text-blue-600"
        : "text-amber-600";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold font-mono mt-1.5 ${toneClass}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{caption}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass = "text-gray-900",
  noBorder = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center px-4 py-3 ${noBorder ? "" : "border-b border-gray-100"
        }`}
    >
      <span className="text-sm text-gray-500 font-sans">{label}</span>
      <strong className={`font-bold ${valueClass}`}>{value}</strong>
    </div>
  );
}