"use client";

import { useEffect, useRef, useState } from "react";

import {
  loadBetLog,
  makeBetId,
  saveBetLog,
  type PortfolioBet,
} from "@/lib/betLog";

type StakePlan = {
  bookmaker_stake: number;
  betfair_lay_stake: number;
  lay_liability: number;
  total_capital_required: number;
};

export type ArbitrageBet = {
  event: string;
  selection: string;
  bookmaker: string;
  exchange: string;
  type: string;
  back_odds: number;
  lay_odds: number;
  commission: number;
  profit_percentage: number;
  guaranteed_profit: number;
  stake_plan: StakePlan;
  start_time?: string | null;
  found_at?: string;
};

type ScanStatus = "idle" | "scanning" | "complete" | "error";

type ArbitrageResponse = {
  status: ScanStatus;
  scanned_events: number;
  matched_events: number;
  count: number;
  opportunities: ArbitrageBet[];
  last_updated: string | null;
  next_scan_at: string | null;
  error?: string;
};

const API_URL = "http://127.0.0.1:8000";

// How often the FRONTEND re-reads the database. This is independent
// of, and deliberately much shorter than, the backend's 30-minute
// scan interval -- this just re-reads the last saved results (a
// cheap DB read), it does not trigger a new scan.
//
// Previously this was set to 30 minutes, the same as the backend
// scan interval. That meant two unsynced 30-min timers: the backend
// could finish a scan and save a new arb, but the frontend's own
// independent 30-min timer might not fire again for close to
// another 30 minutes -- hence "shows up on manual refresh but not
// automatically." Polling every 30s instead means new data shows
// up within 30s of the backend finishing.
const POLL_INTERVAL_MS = 30 * 1000;

export default function OddsTable({
  selectBet,
  onOpportunitiesChange,
}: {
  selectBet?: (bet: ArbitrageBet) => void;
  onOpportunitiesChange?: (info: {
    bets: ArbitrageBet[];
    status: ScanStatus;
    lastUpdated: string | null;
  }) => void;
}) {
  // ==================================================
  // SCANNER STATE
  // ==================================================
  const [bets, setBets] = useState<ArbitrageBet[]>([]);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The real 30-min scan schedule, as tracked by the backend. This
  // is a server timestamp -- accurate regardless of page refreshes
  // or multiple tabs, and genuinely pushed back whenever a scan
  // (auto OR manual) starts, unlike a client-only timer would be.
  const [nextScanAt, setNextScanAt] = useState<string | null>(null);

  // ==================================================
  // PORTFOLIO / LOG STATE
  // ==================================================
  const [portfolioBets, setPortfolioBets] = useState<PortfolioBet[]>([]);
  const [logBet, setLogBet] = useState<ArbitrageBet | null>(null);
  const [logStake, setLogStake] = useState("100");

  // ==================================================
  // AGE / REFRESH TIMER
  // ==================================================
  const [now, setNow] = useState(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPortfolioBets(loadBetLog());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function updateFromResponse(data: ArbitrageResponse) {
    setStatus(data.status);
    setLastUpdated(data.last_updated ?? null);
    setNextScanAt(data.next_scan_at ?? null);
    setBets(data.opportunities ?? []);
    setError(data.status === "error" ? data.error ?? "Scanner failed" : null);
  }

  function formatMatchTime(
    startTime?: string | null
  ) {
    if (!startTime) {
      return {
        date: "—",
        time: "—",
      };
    }

    const date = new Date(startTime);

    return {
      date: date.toLocaleDateString(
        "en-AU",
        {
          day: "2-digit",
          month: "short",
        }
      ),

      time: date.toLocaleTimeString(
        "en-AU",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ),
    };
  }


  async function copyText(
    value: string
  ) {
    try {
      await navigator.clipboard.writeText(
        value
      );
    } catch {
      // Clipboard unavailable
    }
  }
  async function loadLatestResults() {
    try {
      const response = await fetch(`${API_URL}/value-bets/arbitrage`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      const data: ArbitrageResponse = await response.json();
      updateFromResponse(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to connect to backend";
      setError(message);
      return null;
    }
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      await loadLatestResults();
    }, POLL_INTERVAL_MS);
  }

  async function startScan() {
    try {
      setError(null);

      const response = await fetch(
        `${API_URL}/value-bets/scan`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to start scan: ${response.status}`
        );
      }

      const data = await response.json();

      if (
        data.status === "started" ||
        data.status === "scanning"
      ) {
        setStatus("scanning");

        // Check backend every 5 seconds ONLY
        // while this manual scan is running.
        const waitForCompletion =
          setInterval(async () => {
            const result =
              await loadLatestResults();

            if (
              result?.status === "complete" ||
              result?.status === "error"
            ) {
              clearInterval(
                waitForCompletion
              );
            }
          }, 5000);
      }

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to start scanner";

      setError(message);
      setStatus("error");
    }
  }

  useEffect(() => {
    async function initialise() {
      setLoading(true);
      await loadLatestResults();
      setLoading(false);
      startPolling();
    }
    initialise();
    return () => stopPolling();
  }, []);

  // ==================================================
  // NOTIFY PARENT PAGE
  // ==================================================
  useEffect(() => {
    onOpportunitiesChange?.({
      bets,
      status,
      lastUpdated,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, status, lastUpdated]);

  // ==================================================
  // PORTFOLIO HELPERS
  // ==================================================
  function makeOpportunityKey(bet: {
    event: string;
    selection: string;
    bookmaker: string;
    back_odds: number;
    lay_odds: number;
  }) {
    return [
      bet.event,
      bet.selection,
      bet.bookmaker,
      bet.back_odds,
      bet.lay_odds,
    ].join("|");
  }

  function isLogged(bet: ArbitrageBet) {
    const key = makeOpportunityKey(bet);
    return portfolioBets.some((p) => makeOpportunityKey(p) === key);
  }

  function openLogModal(bet: ArbitrageBet) {
    setLogBet(bet);
    setLogStake(bet.stake_plan.bookmaker_stake.toFixed(2));
  }

  function saveBetToPortfolio() {
    if (!logBet) return;

    const backStake = Number(logStake);
    if (!Number.isFinite(backStake) || backStake <= 0) return;

    const originalBackStake = logBet.stake_plan.bookmaker_stake;
    if (originalBackStake <= 0) return;

    const ratio = backStake / originalBackStake;

    const portfolioBet: PortfolioBet = {
      id: makeBetId(),
      event: logBet.event,
      selection: logBet.selection,
      bookmaker: logBet.bookmaker,
      exchange: logBet.exchange,
      type: logBet.type,
      back_odds: logBet.back_odds,
      lay_odds: logBet.lay_odds,
      commission: logBet.commission,
      profit_percentage: logBet.profit_percentage,
      guaranteed_profit: logBet.guaranteed_profit * ratio,
      stake_plan: {
        bookmaker_stake: backStake,
        betfair_lay_stake: logBet.stake_plan.betfair_lay_stake * ratio,
        lay_liability: logBet.stake_plan.lay_liability * ratio,
        total_capital_required:
          logBet.stake_plan.total_capital_required * ratio,
      },
      status: "open",
      result: null,
      settled_profit: null,
      clv: null,
      found_at: logBet.found_at,
      placed_at: new Date().toISOString(),
      start_time: null,
      notes: "",
    };

    const opportunityKey = makeOpportunityKey(portfolioBet);
    const withoutDuplicate = portfolioBets.filter(
      (item) => makeOpportunityKey(item) !== opportunityKey
    );
    const updated = [portfolioBet, ...withoutDuplicate];

    setPortfolioBets(updated);
    saveBetLog(updated);
    setLogBet(null);
  }

  // ==================================================
  // AGE HELPERS
  // ==================================================
  function getAgeSeconds(foundAt?: string) {
    if (!foundAt) return null;
    const found = new Date(foundAt).getTime();
    return Math.max(0, Math.floor((now - found) / 1000));
  }

  function formatAge(seconds: number | null) {
    if (seconds === null) return "—";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  }

  // ==================================================
  // EDGE GAUGE — visualizes the implied-probability gap
  // between the back leg and the lay leg (the arb itself)
  // ==================================================
  function getEdgeGeometry(bet: {
    back_odds: number;
    lay_odds: number;
  }) {
    const backProb = (1 / bet.back_odds) * 100;
    const layProb = (1 / bet.lay_odds) * 100;
    const lo = Math.min(backProb, layProb);
    const hi = Math.max(backProb, layProb);
    const pad = Math.max((hi - lo) * 0.8, 4);
    const windowLo = Math.max(0, lo - pad);
    const windowHi = Math.min(100, hi + pad);
    const span = windowHi - windowLo || 1;

    const toPct = (v: number) => ((v - windowLo) / span) * 100;

    return {
      backPct: toPct(backProb),
      layPct: toPct(layProb),
      edgeStart: toPct(lo),
      edgeWidth: toPct(hi) - toPct(lo),
    };
  }

  // The real "next scan" countdown, computed from the backend's
  // next_scan_at timestamp -- ticks down using the same 1-second
  // `now` timer already used for opportunity ages.
  const scanCountdownSeconds = nextScanAt
    ? Math.max(0, Math.ceil((new Date(nextScanAt).getTime() - now) / 1000))
    : null;

  const scanCountdownText =
    scanCountdownSeconds === null
      ? "—"
      : `${Math.floor(scanCountdownSeconds / 60)}:${(scanCountdownSeconds % 60)
          .toString()
          .padStart(2, "0")}`;

  // ==================================================
  // MODAL CALCULATIONS
  // ==================================================
  const logStakeNumber = Number(logStake);
  const logRatio =
    logBet &&
      Number.isFinite(logStakeNumber) &&
      logStakeNumber > 0 &&
      logBet.stake_plan.bookmaker_stake > 0
      ? logStakeNumber / logBet.stake_plan.bookmaker_stake
      : 0;

  const calculatedLayStake = logBet
    ? logBet.stake_plan.betfair_lay_stake * logRatio
    : 0;
  const calculatedLiability = logBet
    ? logBet.stake_plan.lay_liability * logRatio
    : 0;
  const calculatedCapital = logBet
    ? logBet.stake_plan.total_capital_required * logRatio
    : 0;
  const calculatedProfit = logBet ? logBet.guaranteed_profit * logRatio : 0;

  // ==================================================
  // LOADING
  // ==================================================
  if (loading) {
    return (
      <div className="bg-[#10141B] rounded-2xl border border-[#232A38] p-12 text-center">
        <div className="inline-flex items-center gap-3 text-[#8992A6] font-mono text-sm">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
          Connecting to scanner…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================
          ARBITRAGE OPPORTUNITIES
      ============================================ */}
      <div className="bg-[#10141B] rounded-2xl border border-[#232A38] shadow-xl shadow-black/20 overflow-hidden">
        {/* HEADER */}
        <div className="flex flex-col gap-4 px-5 py-5 border-b border-[#232A38] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#E8ECF3] tracking-tight sm:text-xl">
                Arbitrage Opportunities
              </h2>

              {bets.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-[11px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  {bets.length} LIVE
                </span>
              )}
            </div>

            <p className="text-xs text-[#8992A6] mt-1.5 font-mono flex flex-wrap items-center gap-x-1.5">
              <span
                className={
                  status === "scanning"
                    ? "text-[#F5B942]"
                    : status === "error"
                      ? "text-[#FF6B81]"
                      : "text-[#8992A6]"
                }
              >
                {status === "scanning"
                  ? "SCANNING MARKETS…"
                  : status === "error"
                    ? "SCANNER ERROR"
                    : "SCANNER ONLINE"}
              </span>

              {lastUpdated && (
                <span>
                  · updated {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}

              <span className="w-full sm:w-auto" title="Time until the scanner automatically re-scans Betfair + bookmaker odds. Resets whenever a scan starts, manual or automatic.">
                · next scan in{" "}
                <span className="text-[#E8ECF3] font-semibold">
                  {status === "scanning" ? "running now…" : scanCountdownText}
                </span>
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={startScan}
            disabled={status === "scanning"}
            className="w-full sm:w-auto shrink-0 bg-[#34D399] hover:bg-[#2BBF8A] disabled:bg-[#232A38] disabled:text-[#8992A6] disabled:cursor-not-allowed text-[#06120D] px-5 py-2.5 rounded-xl text-sm font-bold transition"
          >
            {status === "scanning" ? "Scanning…" : "Scan Markets"}
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="m-5 bg-[#FF6B81]/10 border border-[#FF6B81]/30 text-[#FF6B81] p-4 rounded-xl text-sm font-mono">
            {error}
          </div>
        )}

        {/* EMPTY */}
        {bets.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-3xl mb-3 opacity-70">⚡</div>
            <p className="font-semibold text-[#E8ECF3]">
              No live arbitrage opportunities
            </p>
            <p className="text-sm text-[#8992A6] mt-2 max-w-sm mx-auto">
              EdgePulse will display opportunities here when bookmaker back
              odds beat Betfair lay prices.
            </p>
          </div>
        ) : (
          <div>
            {/* DESKTOP / TABLET TABLE */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full min-w-[1200px]">

                <thead className="bg-[#151A23] border-b border-[#232A38]">
                  <tr className="text-[10px] uppercase tracking-widest text-[#8992A6] font-mono">

                    <th className="px-4 py-3 text-left font-medium">
                      Date / Time
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Match
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Team
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Back
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Lay
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Stakes
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Edge
                    </th>

                    <th className="px-4 py-3 text-center font-medium">
                      Age
                    </th>

                    <th className="px-4 py-3 text-center font-medium">
                      Log
                    </th>

                    <th className="px-4 py-3 text-center font-medium">
                      Action
                    </th>

                  </tr>
                </thead>


                <tbody>
                  {bets.map((bet, index) => {

                    const age =
                      getAgeSeconds(
                        bet.found_at
                      );

                    const stale =
                      age !== null &&
                      age > 60;

                    const logged =
                      isLogged(
                        bet
                      );

                    const edge =
                      getEdgeGeometry(
                        bet
                      );


                    // -----------------------------------------
                    // MATCH START DATE / TIME
                    // -----------------------------------------

                    const matchDate =
                      bet.start_time
                        ? new Date(
                          bet.start_time
                        )
                        : null;


                    const matchDateText =
                      matchDate
                        ? matchDate.toLocaleDateString(
                          "en-AU",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )
                        : "—";


                    const matchTimeText =
                      matchDate
                        ? matchDate.toLocaleTimeString(
                          "en-AU",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                        : "—";


                    return (
                      <tr
                        key={`${bet.event}-${bet.selection}-${index}`}
                        className="
              border-b
              border-[#1B202B]
              hover:bg-[#151A23]
              transition
            "
                      >

                        {/* =====================================
                DATE / TIME
            ===================================== */}

                        <td className="px-4 py-4 align-top whitespace-nowrap">

                          <p className="text-sm font-semibold text-[#E8ECF3]">
                            {matchDateText}
                          </p>

                          <p className="text-xs font-mono text-[#8992A6] mt-1">
                            {matchTimeText}
                          </p>

                        </td>


                        {/* =====================================
                MATCH
            ===================================== */}

                        <td className="px-4 py-4 align-top min-w-[190px]">

                          <p className="font-semibold text-[#E8ECF3] leading-snug">
                            {bet.event}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1.5">

                            <span className="
                  bg-[#5AA9FF]/10
                  text-[#5AA9FF]
                  px-2
                  py-0.5
                  rounded
                  text-[10px]
                  font-mono
                  font-medium
                ">
                              {bet.type || "BACK/LAY"}
                            </span>

                          </div>

                        </td>


                        {/* =====================================
                TEAM / SELECTION + COPY
            ===================================== */}

                        <td className="px-4 py-4 align-top min-w-[150px]">

                          <div className="flex items-center gap-2">

                            <span className="text-sm font-semibold text-[#E8ECF3]">
                              {bet.selection}
                            </span>

                            <button
                              type="button"
                              title="Copy team"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  bet.selection
                                );
                              }}
                              className="
                    shrink-0
                    w-7
                    h-7
                    flex
                    items-center
                    justify-center
                    rounded-md
                    border
                    border-[#2A313F]
                    text-[#8992A6]
                    hover:text-[#E8ECF3]
                    hover:border-[#3A4356]
                    transition
                    text-xs
                  "
                            >
                              ⧉
                            </button>

                          </div>

                        </td>


                        {/* =====================================
                BACK
            ===================================== */}

                        <td className="px-4 py-4 align-top">

                          <div className="flex items-center gap-2">

                            {/* bookmaker icon / initials */}

                            <div className="
                  shrink-0
                  w-8
                  h-8
                  rounded-lg
                  border
                  border-[#5AA9FF]/20
                  bg-[#5AA9FF]/10
                  flex
                  items-center
                  justify-center
                  text-[9px]
                  font-bold
                  font-mono
                  text-[#5AA9FF]
                ">
                              {bet.bookmaker
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>


                            <div>

                              <p className="
                    text-xs
                    text-[#B7BECC]
                    whitespace-nowrap
                  ">
                                {bet.bookmaker}
                              </p>

                              <p className="
                    text-base
                    font-bold
                    font-mono
                    text-[#5AA9FF]
                    mt-0.5
                  ">
                                {bet.back_odds}
                              </p>

                            </div>

                          </div>

                        </td>


                        {/* =====================================
                LAY
            ===================================== */}

                        <td className="px-4 py-4 align-top">

                          <div className="flex items-center gap-2">

                            {/* Betfair badge */}

                            <div className="
                  shrink-0
                  w-8
                  h-8
                  rounded-lg
                  border
                  border-[#FF6B81]/20
                  bg-[#FF6B81]/10
                  flex
                  items-center
                  justify-center
                  text-[9px]
                  font-bold
                  font-mono
                  text-[#FF6B81]
                ">
                              BF
                            </div>


                            <div>

                              <p className="
                    text-xs
                    text-[#B7BECC]
                    whitespace-nowrap
                  ">
                                {bet.exchange}
                              </p>

                              <p className="
                    text-base
                    font-bold
                    font-mono
                    text-[#FF6B81]
                    mt-0.5
                  ">
                                {bet.lay_odds}
                              </p>

                            </div>

                          </div>

                        </td>


                        {/* =====================================
                BACK / LAY STAKES + COPY
            ===================================== */}

                        <td className="px-4 py-4 align-top min-w-[170px]">

                          <div className="space-y-2 font-mono text-xs">

                            {/* BACK STAKE */}

                            <div className="flex items-center gap-2">

                              <span className="
                    w-10
                    text-[9px]
                    font-bold
                    text-[#5AA9FF]
                  ">
                                BACK
                              </span>

                              <strong className="text-[#E8ECF3]">
                                $
                                {bet
                                  .stake_plan
                                  .bookmaker_stake
                                  .toFixed(2)}
                              </strong>

                              <button
                                type="button"
                                title="Copy back stake"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    bet
                                      .stake_plan
                                      .bookmaker_stake
                                      .toFixed(2)
                                  );
                                }}
                                className="
                      w-6
                      h-6
                      flex
                      items-center
                      justify-center
                      rounded
                      border
                      border-[#2A313F]
                      text-[#8992A6]
                      hover:text-[#E8ECF3]
                      hover:border-[#3A4356]
                      transition
                    "
                              >
                                ⧉
                              </button>

                            </div>


                            {/* LAY STAKE */}

                            <div className="flex items-center gap-2">

                              <span className="
                    w-10
                    text-[9px]
                    font-bold
                    text-[#FF6B81]
                  ">
                                LAY
                              </span>

                              <strong className="text-[#E8ECF3]">
                                $
                                {bet
                                  .stake_plan
                                  .betfair_lay_stake
                                  .toFixed(2)}
                              </strong>

                              <button
                                type="button"
                                title="Copy lay stake"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    bet
                                      .stake_plan
                                      .betfair_lay_stake
                                      .toFixed(2)
                                  );
                                }}
                                className="
                      w-6
                      h-6
                      flex
                      items-center
                      justify-center
                      rounded
                      border
                      border-[#2A313F]
                      text-[#8992A6]
                      hover:text-[#E8ECF3]
                      hover:border-[#3A4356]
                      transition
                    "
                              >
                                ⧉
                              </button>

                            </div>

                          </div>

                        </td>


                        {/* =====================================
                EDGE
            ===================================== */}

                        <td className="px-4 py-4 min-w-[140px]">

                          <div className="
                relative
                h-1.5
                rounded-full
                bg-[#1B202B]
                overflow-hidden
              ">

                            <div
                              className="
                    absolute
                    top-0
                    h-full
                    bg-[#34D399]/60
                  "
                              style={{
                                left:
                                  `${edge.edgeStart}%`,

                                width:
                                  `${edge.edgeWidth}%`,
                              }}
                            />


                            <div
                              className="
                    absolute
                    top-1/2
                    -translate-y-1/2
                    w-1.5
                    h-1.5
                    rounded-full
                    bg-[#5AA9FF]
                    ring-2
                    ring-[#10141B]
                  "
                              style={{
                                left:
                                  `calc(${edge.backPct}% - 3px)`,
                              }}
                            />


                            <div
                              className="
                    absolute
                    top-1/2
                    -translate-y-1/2
                    w-1.5
                    h-1.5
                    rounded-full
                    bg-[#FF6B81]
                    ring-2
                    ring-[#10141B]
                  "
                              style={{
                                left:
                                  `calc(${edge.layPct}% - 3px)`,
                              }}
                            />

                          </div>


                          <p className="
                mt-1.5
                font-mono
                text-xs
                font-bold
                text-[#34D399]
              ">
                            +
                            {bet
                              .profit_percentage
                              .toFixed(2)}
                            % ROI
                          </p>

                        </td>


                        {/* =====================================
                AGE
            ===================================== */}

                        <td className="px-4 py-4 text-center align-top">

                          <p
                            className={`
                  text-xs
                  font-semibold
                  font-mono
                  ${stale
                                ? "text-[#F5B942]"
                                : "text-[#34D399]"
                              }
                `}
                          >
                            {stale
                              ? "AVAILABLE"
                              : "FRESH"}
                          </p>


                          <p className="
                text-[10px]
                text-[#5A6270]
                mt-0.5
                font-mono
              ">
                            {formatAge(age)}
                          </p>

                        </td>


                        {/* =====================================
                LOG
            ===================================== */}

                        <td className="px-4 py-4 text-center align-top">

                          <button
                            type="button"
                            onClick={() =>
                              openLogModal(
                                bet
                              )
                            }
                            title={
                              logged
                                ? "Already in Portfolio"
                                : "Log to Portfolio"
                            }
                            className={`
                  w-9
                  h-9
                  rounded-lg
                  border
                  font-bold
                  transition
                  ${logged
                                ? "bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]"
                                : "bg-transparent border-[#2A313F] text-[#8992A6] hover:border-[#3A4356] hover:text-[#E8ECF3]"
                              }
                `}
                          >
                            {logged
                              ? "✓"
                              : "＋"}
                          </button>

                        </td>


                        {/* =====================================
                ACTION
            ===================================== */}

                        <td className="px-4 py-4 text-center align-top">

                          <button
                            type="button"
                            onClick={() =>
                              selectBet?.(
                                bet
                              )
                            }
                            className="
                  bg-[#1B202B]
                  hover:bg-[#232A38]
                  border
                  border-[#2A313F]
                  text-[#E8ECF3]
                  px-4
                  py-2
                  rounded-lg
                  text-xs
                  font-semibold
                  transition
                "
                          >
                            Details
                          </button>

                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
            {/* MOBILE CARDS */}
            <div className="md:hidden p-3 space-y-3">
              {bets.map((bet, index) => {
                const age = getAgeSeconds(bet.found_at);
                const stale = age !== null && age > 60;
                const logged = isLogged(bet);
                const edge = getEdgeGeometry(bet);

                return (
                  <div
                    key={`mobile-${bet.event}-${bet.selection}-${index}`}
                    className="rounded-2xl border border-[#232A38] bg-[#151A23] overflow-hidden"
                  >
                    <div className="px-4 py-4 border-b border-[#1B202B]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[#E8ECF3] leading-snug break-words">
                            {bet.event}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="bg-[#5AA9FF]/10 text-[#5AA9FF] px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                              {bet.type || "BACK/LAY"}
                            </span>
                            <span className="text-[10px] text-[#5A6270] font-mono">
                              {bet.selection}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openLogModal(bet)}
                          aria-label="Log opportunity to portfolio"
                          className={`shrink-0 w-10 h-10 rounded-xl border font-bold transition ${logged
                            ? "bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]"
                            : "bg-transparent border-[#2A313F] text-[#8992A6]"
                            }`}
                        >
                          {logged ? "✓" : "＋"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-[#1B202B] border-b border-[#1B202B] font-mono">
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-[#5AA9FF]/10 text-[#5AA9FF] rounded px-1.5 py-0.5 text-[9px] font-bold">
                            BACK
                          </span>
                          <span className="text-xs text-[#B7BECC] truncate">
                            {bet.bookmaker}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-[#E8ECF3]">
                          {bet.back_odds}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-[#FF6B81]/10 text-[#FF6B81] rounded px-1.5 py-0.5 text-[9px] font-bold">
                            LAY
                          </span>
                          <span className="text-xs text-[#B7BECC] truncate">
                            {bet.exchange}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-[#E8ECF3]">
                          {bet.lay_odds}
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-b border-[#1B202B]">
                      <div className="relative h-1.5 rounded-full bg-[#1B202B] overflow-hidden">
                        <div
                          className="absolute top-0 h-full bg-[#34D399]/60"
                          style={{
                            left: `${edge.edgeStart}%`,
                            width: `${edge.edgeWidth}%`,
                          }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#5AA9FF] ring-2 ring-[#151A23]"
                          style={{ left: `calc(${edge.backPct}% - 3px)` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FF6B81] ring-2 ring-[#151A23]"
                          style={{ left: `calc(${edge.layPct}% - 3px)` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-[#1B202B] border-b border-[#1B202B]">
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#5A6270] font-mono font-semibold">
                          ROI
                        </p>
                        <p className="text-lg font-bold text-[#34D399] mt-1 font-mono">
                          +{bet.profit_percentage.toFixed(2)}%
                        </p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#5A6270] font-mono font-semibold">
                          Profit
                        </p>
                        <p className="text-lg font-bold text-[#34D399] mt-1 font-mono">
                          ${bet.guaranteed_profit.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#12161F]">
                      <div>
                        <p
                          className={`text-xs font-semibold font-mono ${stale ? "text-[#F5B942]" : "text-[#34D399]"
                            }`}
                        >
                          {stale ? "AVAILABLE" : "FRESH"}
                        </p>
                        <p className="text-[11px] text-[#5A6270] mt-0.5 font-mono">
                          found {formatAge(age)} ago
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectBet?.(bet)}
                        className="bg-[#1B202B] active:bg-[#232A38] border border-[#2A313F] text-[#E8ECF3] px-5 py-2.5 rounded-xl text-sm font-semibold"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================
          LOG TO PORTFOLIO MODAL
      ============================================ */}
      {logBet && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-3 overflow-y-auto sm:items-center sm:p-4">
          <div
            onClick={() => setLogBet(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg max-h-[calc(100vh-1.5rem)] bg-[#10141B] rounded-2xl shadow-2xl border border-[#232A38] overflow-hidden sm:max-h-[calc(100vh-2rem)]">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#232A38]">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#34D399] font-mono font-bold">
                  Log to Portfolio
                </p>
                <h3 className="text-xl font-bold text-[#E8ECF3] mt-1">
                  {logBet.event}
                </h3>
                <p className="text-sm text-[#8992A6] mt-1">
                  {logBet.selection}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogBet(null)}
                className="text-[#5A6270] hover:text-[#E8ECF3] text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="bg-[#5AA9FF]/5 border border-[#5AA9FF]/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#5AA9FF] font-mono tracking-wide">
                    BACK
                  </p>
                  <p className="font-bold text-[#E8ECF3] mt-2">
                    {logBet.bookmaker}
                  </p>
                  <p className="text-sm text-[#8992A6] mt-1">
                    {logBet.selection}
                  </p>
                  <p className="text-3xl font-bold text-[#5AA9FF] mt-3 font-mono">
                    {logBet.back_odds}
                  </p>
                </div>

                <div className="bg-[#FF6B81]/5 border border-[#FF6B81]/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#FF6B81] font-mono tracking-wide">
                    LAY
                  </p>
                  <p className="font-bold text-[#E8ECF3] mt-2">
                    {logBet.exchange}
                  </p>
                  <p className="text-sm text-[#8992A6] mt-1">
                    {logBet.selection}
                  </p>
                  <p className="text-3xl font-bold text-[#FF6B81] mt-3 font-mono">
                    {logBet.lay_odds}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold text-[#B7BECC] mb-2">
                  How much did you back? ($)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={logStake}
                  onChange={(event) => setLogStake(event.target.value)}
                  autoFocus
                  className="w-full bg-[#151A23] border border-[#2A313F] rounded-xl px-4 py-3 text-2xl font-bold font-mono text-[#E8ECF3] outline-none focus:ring-2 focus:ring-[#34D399] focus:border-[#34D399]"
                />
              </div>

              {logStakeNumber > 0 && (
                <div className="mt-5 bg-[#151A23] border border-[#232A38] rounded-xl overflow-hidden font-mono text-sm">
                  <Row label="Back stake" value={`$${logStakeNumber.toFixed(2)}`} />
                  <Row
                    label="Required lay stake"
                    value={`$${calculatedLayStake.toFixed(2)}`}
                    valueClass="text-[#FF6B81]"
                  />
                  <Row
                    label="Betfair liability"
                    value={`$${calculatedLiability.toFixed(2)}`}
                  />
                  <Row
                    label="Total capital"
                    value={`$${calculatedCapital.toFixed(2)}`}
                  />
                  <Row
                    label="Expected profit"
                    value={`+$${calculatedProfit.toFixed(2)}`}
                    valueClass="text-[#34D399] text-base"
                    labelClass="font-sans font-semibold text-[#E8ECF3]"
                    noBorder
                  />
                </div>
              )}

              <div className="mt-4 flex justify-between items-center bg-[#34D399]/10 border border-[#34D399]/30 rounded-xl px-4 py-3">
                <span className="text-sm text-[#34D399]/90">Arbitrage ROI</span>
                <span className="font-bold text-[#34D399] font-mono">
                  +{logBet.profit_percentage.toFixed(2)}%
                </span>
              </div>

              <p className="text-xs text-[#5A6270] mt-4">
                This saves the position to your Portfolio. It does not place
                either bet automatically.
              </p>

              <button
                type="button"
                onClick={saveBetToPortfolio}
                disabled={!Number.isFinite(logStakeNumber) || logStakeNumber <= 0}
                className="w-full mt-6 bg-[#34D399] hover:bg-[#2BBF8A] disabled:bg-[#232A38] disabled:text-[#5A6270] disabled:cursor-not-allowed text-[#06120D] rounded-xl py-3 font-bold transition"
              >
                Add to Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-[#E8ECF3]",
  labelClass = "text-[#8992A6] font-sans",
  noBorder = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  labelClass?: string;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center px-4 py-3 ${noBorder ? "" : "border-b border-[#1B202B]"
        }`}
    >
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <strong className={`font-bold ${valueClass}`}>{value}</strong>
    </div>
  );
}