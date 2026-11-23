"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

const API_URL = "http://127.0.0.1:8000";

type LastRun = {
  status: "complete" | "error";
  error: string | null;
  scanned_events: number;
  matched_events: number;
  opportunities_found: number;
};

type SportRow = {
  sport: string;
  name: string;
  enabled: boolean;
  live_opportunities: number;
  last_run: LastRun | null;
};

type SportsResponse = {
  sports: SportRow[];
};

export default function SportsPage() {
  const [sports, setSports] = useState<SportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sports currently mid-toggle, so their switch can show a disabled/
  // pending state instead of letting a second click race the first.
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function loadSports() {
    try {
      const res = await fetch(`${API_URL}/value-bets/sports`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: SportsResponse = await res.json();
      setSports(data.sports ?? []);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load sports";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSports();
    const interval = setInterval(loadSports, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleToggle(sport: string) {
    setPending((prev) => new Set(prev).add(sport));

    // Optimistic flip so the switch feels instant; corrected by the
    // server response (or reverted on failure) right after.
    setSports((prev) =>
      prev.map((row) =>
        row.sport === sport ? { ...row, enabled: !row.enabled } : row
      )
    );

    try {
      const res = await fetch(
        `${API_URL}/value-bets/sports/${encodeURIComponent(sport)}/toggle`,
        { method: "POST" }
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSports((prev) =>
        prev.map((row) =>
          row.sport === sport ? { ...row, enabled: data.enabled } : row
        )
      );
    } catch {
      // Revert the optimistic flip on failure.
      setSports((prev) =>
        prev.map((row) =>
          row.sport === sport ? { ...row, enabled: !row.enabled } : row
        )
      );
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(sport);
        return next;
      });
    }
  }

  const enabledCount = sports.filter((s) => s.enabled).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Navbar />

          <main className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">
            {/* HEADER */}
            <div className="mb-8">
              <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
                Scanner configuration
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1 sm:text-3xl">
                Sports
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                Choose which sports the scanner covers, and see how each one
                performed on its last run. Toggling a sport takes effect on
                the next scan &mdash; it won&apos;t interrupt one already in
                progress.
              </p>
            </div>

            {/* SUMMARY STRIP */}
            <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 sm:gap-4">
              <SummaryCard
                label="Sports enabled"
                value={loading ? "…" : `${enabledCount} / ${sports.length}`}
              />
              <SummaryCard
                label="Live opportunities"
                value={
                  loading
                    ? "…"
                    : sports
                        .reduce((sum, s) => sum + s.live_opportunities, 0)
                        .toString()
                }
              />
              <SummaryCard
                label="Sports with errors"
                value={
                  loading
                    ? "…"
                    : sports
                        .filter((s) => s.last_run?.status === "error")
                        .length.toString()
                }
                tone={
                  sports.some((s) => s.last_run?.status === "error")
                    ? "danger"
                    : "neutral"
                }
              />
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* SPORTS LIST */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-16 text-center text-sm text-gray-400 font-mono">
                  Loading sports…
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sports.map((row) => (
                    <SportRowItem
                      key={row.sport}
                      row={row}
                      disabled={pending.has(row.sport)}
                      onToggle={() => handleToggle(row.sport)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-semibold">
        {label}
      </p>
      <p
        className={`text-2xl font-bold font-mono mt-1.5 ${
          tone === "danger" && value !== "0" ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SportRowItem({
  row,
  disabled,
  onToggle,
}: {
  row: SportRow;
  disabled: boolean;
  onToggle: () => void;
}) {
  const lastRun = row.last_run;

  return (
    <li className="px-5 py-4 flex items-center justify-between gap-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{row.name}</p>
          {!row.enabled && (
            <span className="text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              PAUSED
            </span>
          )}
          {lastRun?.status === "error" && (
            <span className="text-[10px] font-mono font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
              LAST RUN FAILED
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-1 font-mono">
          {lastRun ? (
            lastRun.status === "error" ? (
              <span className="text-red-600">{lastRun.error}</span>
            ) : (
              <>
                {lastRun.scanned_events} scanned · {lastRun.matched_events}{" "}
                matched · {lastRun.opportunities_found} arb
                {lastRun.opportunities_found === 1 ? "" : "s"} found
              </>
            )
          ) : (
            "No scan data yet"
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-bold font-mono text-green-600">
            {row.live_opportunities}
          </p>
          <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">
            live now
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={row.enabled}
          aria-label={`Toggle scanning for ${row.name}`}
          disabled={disabled}
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
            row.enabled ? "bg-green-600" : "bg-gray-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              row.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </li>
  );
}