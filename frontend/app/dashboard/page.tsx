"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

const API_URL = "http://127.0.0.1:8000";

type ScanStatus = "idle" | "scanning" | "complete" | "error";

type Opportunity = {
  event: string;
  selection: string;
  bookmaker: string;
  exchange: string;
  back_odds: number;
  lay_odds: number;
  profit_percentage: number;
  guaranteed_profit: number;
  sport?: string;
};

type ArbitrageResponse = {
  status: ScanStatus;
  count: number;
  opportunities: Opportunity[];
  last_updated: string | null;
};

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/value-bets/arbitrage`, {
          cache: "no-store",
        });
        const data: ArbitrageResponse = await res.json();
        if (cancelled) return;
        setOpportunities(data.opportunities ?? []);
        setStatus(data.status ?? "idle");
        setLastUpdated(data.last_updated ?? null);
      } catch {
        // Dashboard degrades quietly to zero-state if the API is down --
        // the Arbitrage page itself is where connection errors surface.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const bestRoi = opportunities.length
    ? Math.max(...opportunities.map((o) => o.profit_percentage))
    : null;

  const topOpportunities = [...opportunities]
    .sort((a, b) => b.profit_percentage - a.profit_percentage)
    .slice(0, 4);

  async function handleScanNow() {
    setScanning(true);
    try {
      await fetch(`${API_URL}/value-bets/scan`, { method: "POST" });
    } catch {
      // no-op -- Arbitrage page shows the real error state
    } finally {
      // Manual scans run in the background; this just gives the button
      // a moment of feedback rather than blocking on completion.
      setTimeout(() => setScanning(false), 2000);
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Navbar />

          <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {/* HEADER */}
            <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
                  Overview
                </p>
                <h1 className="text-2xl font-bold text-gray-900 mt-1 sm:text-3xl">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-2">
                  {lastUpdated
                    ? `Scanner last ran ${new Date(lastUpdated).toLocaleTimeString()}`
                    : "Waiting on the first scan"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleScanNow}
                disabled={scanning || status === "scanning"}
                className="shrink-0 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition"
              >
                {scanning || status === "scanning" ? "Scanning…" : "Scan markets"}
              </button>
            </div>

            {/* STAT STRIP */}
            <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4 sm:gap-4">
              <StatCard
                label="Bankroll"
                value="—"
                caption="connect Bookmakers to track"
                tone="neutral"
              />
              <StatCard
                label="Live opportunities"
                value={loading ? "…" : opportunities.length.toString()}
                caption={status === "scanning" ? "scanning…" : "on the board"}
                tone={status === "scanning" ? "amber" : "green"}
              />
              <StatCard
                label="Best ROI"
                value={bestRoi !== null ? `+${bestRoi.toFixed(2)}%` : "—"}
                caption="top live opportunity"
                tone="blue"
              />
              <StatCard
                label="Open bets"
                value="—"
                caption="log a bet to start tracking"
                tone="neutral"
              />
            </div>

            {/* TWO COLUMN: LIVE OPPORTUNITIES + RECENT BETS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* LIVE OPPORTUNITIES PREVIEW */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-900">
                    Top live opportunities
                  </h2>
                  <Link
                    href="/arbitrage"
                    className="text-xs font-mono text-blue-600 hover:text-blue-700 transition"
                  >
                    View all →
                  </Link>
                </div>

                {loading ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-400 font-mono">
                    Loading…
                  </div>
                ) : topOpportunities.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-gray-900">
                      No live opportunities
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Run a scan or wait for the next automatic cycle.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {topOpportunities.map((opp, i) => (
                      <li
                        key={`${opp.event}-${opp.selection}-${i}`}
                        className="px-5 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {opp.event}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {opp.selection} · {opp.bookmaker}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold text-green-600">
                          +{opp.profit_percentage.toFixed(2)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* RECENT BETS PREVIEW */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-900">
                    Recent bets
                  </h2>
                  <Link
                    href="/my-bets"
                    className="text-xs font-mono text-blue-600 hover:text-blue-700 transition"
                  >
                    View all →
                  </Link>
                </div>

                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    Bet tracking not connected yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    This panel will show your last logged bets once the
                    /bets API is wired up.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
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
  tone: "green" | "blue" | "amber" | "neutral";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600"
      : tone === "blue"
      ? "text-blue-600"
      : tone === "amber"
      ? "text-amber-600"
      : "text-gray-400";

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