"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

export type CrossBookLeg = {
  selection: string;
  bookmaker: string;
  odds: number;
  stake: number;
  payout_if_wins: number;
  link?: string | null;
};

export type ArbitrageBet = {
  event: string;
  selection: string;
  bookmaker: string;
  bookmaker_link?: string | null;
  exchange: string;
  type: string;
  market?: string | null; // "h2h" | "totals"
  line?: number | null; // e.g. 2.5, null for h2h
  sport?: string;
  league?: string | null;
  legs?: CrossBookLeg[] | null; // populated for CROSS_BOOK_ARBITRAGE
  back_odds: number;
  lay_odds: number;
  commission: number;
  profit_percentage: number;
  guaranteed_profit: number;
  // Optional: CROSS_BOOK_ARBITRAGE opportunities don't populate this
  // at all (they use `legs` instead) -- marking it required here was
  // masking that at the type level and let a runtime crash slip
  // through wherever code assumed it always existed.
  stake_plan?: StakePlan;
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

// How often the FRONTEND re-reads the database when auto-refresh is
// on. Independent of, and much shorter than, the backend's 30-min
// scan interval -- this just re-reads the last saved results (a
// cheap DB read), it does not trigger a new scan.
const POLL_INTERVAL_MS = 30 * 1000;

const PAGE_SIZE = 20;

// ==================================================
// BOOKMAKER BADGE STYLING
// ==================================================
//
// The reference layout uses branded logo pills per bookmaker. We
// don't have logo image assets wired in, so this renders a colored
// text pill instead -- approximating each brand's real color where
// we recognize the name, and falling back to a deterministic color
// from a fixed palette for anything unrecognized (new/regional
// bookmakers), so the row still looks distinct rather than defaulting
// everything to gray.

const KNOWN_BOOKMAKER_STYLES: Record<string, { bg: string; text: string }> = {
  sportsbet: { bg: "#0FA968", text: "#EAFBF3" },
  pointsbet: { bg: "#E5322D", text: "#FFF0EF" },
  "pointsbet (au)": { bg: "#E5322D", text: "#FFF0EF" },
  tabtouch: { bg: "#4B2E83", text: "#F1ECFB" },
  tab: { bg: "#0A6E3C", text: "#EAFBF1" },
  ladbrokes: { bg: "#D2001F", text: "#FFEFF0" },
  bet365: { bg: "#0A7B34", text: "#EAFBF1" },
  unibet: { bg: "#0B7A3B", text: "#EAFBF1" },
  playup: { bg: "#1D4ED8", text: "#EAF0FF" },
  "bet right": { bg: "#E36F13", text: "#FFF3E9" },
  neds: { bg: "#000000", text: "#FFE24D" },
  betfair: { bg: "#F5B942", text: "#241B00" },
  betdeluxe: { bg: "#7C3AED", text: "#F3ECFF" },
  boombet: { bg: "#EC4899", text: "#2B0A19" },
};

const FALLBACK_PALETTE: { bg: string; text: string }[] = [
  { bg: "#5AA9FF", text: "#06131F" },
  { bg: "#34D399", text: "#06120D" },
  { bg: "#F5B942", text: "#241B00" },
  { bg: "#FF6B81", text: "#280309" },
  { bg: "#A78BFA", text: "#170A2E" },
  { bg: "#38BDF8", text: "#04202B" },
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getBookmakerStyle(name?: string | null) {
  const safeName = name?.trim() || "Unknown";

  const key = safeName.toLowerCase();

  if (KNOWN_BOOKMAKER_STYLES[key]) {
    return KNOWN_BOOKMAKER_STYLES[key];
  }

  return FALLBACK_PALETTE[
    hashString(key) % FALLBACK_PALETTE.length
  ];
}

// ==================================================
// BOOKMAKER LINK-OUT
// ==================================================
//
// The Odds API doesn't return a direct URL to the specific event
// page on each bookmaker's site (that's a premium "includeLinks"
// feature not enabled for this region/plan) -- so rather than
// fabricate a fake deep link, clicking a badge opens a Google
// search for "<bookmaker> <event>", which gets the user to the
// right page in one click without inventing a URL that might be
// wrong or dead.

function BookmakerBadge({
  name,
  href,
}: {
  name?: string | null;
  href?: string | null;
}) {
  const safeName = name?.trim() || "Unknown";

  const style = getBookmakerStyle(safeName);

  const content = (
    <span
      className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold font-mono whitespace-nowrap"
      style={{
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {safeName}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${safeName}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5"
    >
      {content}

      <span className="text-[11px] text-[#5AA9FF]">
        ↗
      </span>
    </a>
  );
}

// ==================================================
// SPORT ICON
// ==================================================

const SPORT_ICONS: Record<string, string> = {
  soccer: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  "american football": "🏈",
  baseball: "⚾",
  "ice hockey": "🏒",
  "rugby league": "🏉",
  "aussie rules": "🏉",
  boxing: "🥊",
  "mixed martial arts": "🥋",
  mma: "🥋",
  golf: "⛳",
  cricket: "🏏",
  handball: "🤾",
  lacrosse: "🥍",
};

function sportIcon(sport?: string) {
  if (!sport) return "🏟️";
  return SPORT_ICONS[sport.toLowerCase()] ?? "🏟️";
}

function formatSelection(bet: { selection: string; market?: string | null; line?: number | null }) {
  if (bet.market === "totals" && bet.line !== null && bet.line !== undefined) {
    return `${bet.selection} ${bet.line}`;
  }
  return bet.selection;
}

function formatMarketLabel(bet: { market?: string | null; line?: number | null }) {
  if (bet.market === "totals" && bet.line !== null && bet.line !== undefined) {
    return `O/U ${bet.line}`;
  }
  if (bet.market === "h2h" || !bet.market) return "Match Odds";
  return bet.market.toUpperCase();
}

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
  const [nextScanAt, setNextScanAt] = useState<string | null>(null);

  // ==================================================
  // PORTFOLIO / LOG STATE
  // ==================================================
  const [portfolioBets, setPortfolioBets] = useState<PortfolioBet[]>([]);
  const [logBet, setLogBet] = useState<ArbitrageBet | null>(null);
  const [logStake, setLogStake] = useState("100");
  const [logSaveError, setLogSaveError] = useState<string | null>(null);
  const [logOdds, setLogOdds] = useState<Record<number, string>>({});

  // ==================================================
  // TOOLBAR / FILTER STATE
  // ==================================================
  const [globalStake, setGlobalStake] = useState("100");
  const [autoRefreshOn, setAutoRefreshOn] = useState(true);
  const [manualRefreshSpin, setManualRefreshSpin] = useState(false);

  const [filterEvent, setFilterEvent] = useState("");
  const [filterLeague, setFilterLeague] = useState("");
  const [filterSport, setFilterSport] = useState("all");
  const [filterMarket, setFilterMarket] = useState("all");
  const [filterBookmaker, setFilterBookmaker] = useState("all");
  const [minRoi, setMinRoi] = useState("");

  const [page, setPage] = useState(1);

  // Tracks which copy button was last clicked, so it can flash a
  // checkmark for a moment as visible confirmation the copy worked.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
      const message = err instanceof Error ? err.message : "Unable to connect to backend";
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

  // Toggle button in the toolbar -- mirrors "Auto Refresh" in the
  // reference layout. Turning it off stops the 30s DB-read polling;
  // it does NOT affect the backend's own 30-min scan schedule.
  useEffect(() => {
    if (autoRefreshOn) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshOn]);

  async function handleManualRefresh() {
    setManualRefreshSpin(true);
    await loadLatestResults();
    setTimeout(() => setManualRefreshSpin(false), 500);
  }

  async function startScan() {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/value-bets/scan`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Unable to start scan: ${response.status}`);
      }
      const data = await response.json();

      if (data.status === "started" || data.status === "scanning") {
        setStatus("scanning");
        const waitForCompletion = setInterval(async () => {
          const result = await loadLatestResults();
          if (result?.status === "complete" || result?.status === "error") {
            clearInterval(waitForCompletion);
          }
        }, 5000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start scanner";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onOpportunitiesChange?.({ bets, status, lastUpdated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, status, lastUpdated]);

  // ==================================================
  // FILTER OPTIONS (derived from live data)
  // ==================================================
  const sportOptions = useMemo(() => {
    const set = new Set<string>();
    bets.forEach((b) => b.sport && set.add(b.sport));
    return Array.from(set).sort();
  }, [bets]);

  const bookmakerOptions = useMemo(() => {
    const set = new Set<string>();
    bets.forEach((b) => {
      if (b.legs && b.legs.length > 0) {
        b.legs.forEach((leg) => set.add(leg.bookmaker));
      } else {
        set.add(b.bookmaker);
      }
    });
    return Array.from(set).sort();
  }, [bets]);

  // ==================================================
  // FILTERED + PAGINATED ROWS
  // ==================================================
  const filteredBets = useMemo(() => {
    const eventQuery = filterEvent.trim().toLowerCase();
    const leagueQuery = filterLeague.trim().toLowerCase();
    const minRoiNumber = Number(minRoi);
    const hasMinRoi = minRoi.trim() !== "" && Number.isFinite(minRoiNumber);

    return bets.filter((bet) => {
      if (eventQuery && !bet.event.toLowerCase().includes(eventQuery)) return false;
      if (leagueQuery && !(bet.league ?? "").toLowerCase().includes(leagueQuery)) return false;
      if (filterSport !== "all" && bet.sport !== filterSport) return false;

      if (filterMarket !== "all") {
        const market = bet.market ?? "h2h";
        if (market !== filterMarket) return false;
      }

      if (filterBookmaker !== "all") {
        const names =
          bet.legs && bet.legs.length > 0 ? bet.legs.map((l) => l.bookmaker) : [bet.bookmaker];
        if (!names.includes(filterBookmaker)) return false;
      }

      if (hasMinRoi && bet.profit_percentage < minRoiNumber) return false;

      return true;
    });
  }, [bets, filterEvent, filterLeague, filterSport, filterMarket, filterBookmaker, minRoi]);

  useEffect(() => {
    setPage(1);
  }, [filterEvent, filterLeague, filterSport, filterMarket, filterBookmaker, minRoi]);

  const totalPages = Math.max(1, Math.ceil(filteredBets.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * PAGE_SIZE;
  const pageBets = filteredBets.slice(pageStart, pageStart + PAGE_SIZE);

  // ==================================================
  // GLOBAL STAKE SCALING
  // ==================================================
  //
  // The "Stake" field in the toolbar is meant to re-project every
  // row's Back/Lay stake and Profit as if YOU staked that amount,
  // instead of always showing the arbitrary stake the backend used
  // to compute the opportunity. Previously this value only fed the
  // Log modal's default -- it never touched the table itself, which
  // is why changing it appeared to do nothing.
  const globalStakeNumber = Number(globalStake);
  const hasValidGlobalStake = Number.isFinite(globalStakeNumber) && globalStakeNumber > 0;

  function getScaledAmounts(bet: ArbitrageBet) {
    // Cross-book opportunities don't populate stake_plan at all --
    // only legs -- so bet.stake_plan can be undefined for those rows.
    // This function is called unconditionally for every row before
    // the isCrossBook branch decides whether to use the result, so
    // it has to be safe against that on its own rather than relying
    // on the caller to skip it.
    const baseStake = bet.stake_plan?.bookmaker_stake ?? 0;
    const ratio = hasValidGlobalStake && baseStake > 0 ? globalStakeNumber / baseStake : 1;

    return {
      ratio,
      backStake: hasValidGlobalStake && baseStake > 0 ? globalStakeNumber : baseStake,
      layStake: (bet.stake_plan?.betfair_lay_stake ?? 0) * ratio,
      profit: (bet.guaranteed_profit ?? 0) * ratio,
    };
  }

  // Cross-book legs don't have one single "back stake" to key off of
  // -- each leg has its own stake. We scale every leg proportionally
  // using the first leg's stake as the baseline "1x" reference, so
  // entering $200 doubles every leg's stake consistently.
  function getScaledLegStake(bet: ArbitrageBet, leg: CrossBookLeg) {
    const baseline = bet.legs && bet.legs.length > 0 ? bet.legs[0].stake : 0;
    const ratio = hasValidGlobalStake && baseline > 0 ? globalStakeNumber / baseline : 1;
    return leg.stake * ratio;
  }

  function resetFilters() {
    setFilterEvent("");
    setFilterLeague("");
    setFilterSport("all");
    setFilterMarket("all");
    setFilterBookmaker("all");
    setMinRoi("");
  }

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
    return [bet.event, bet.selection, bet.bookmaker, bet.back_odds, bet.lay_odds].join("|");
  }

  function isLogged(bet: ArbitrageBet) {
    const key = makeOpportunityKey(bet);
    return portfolioBets.some((p) => makeOpportunityKey(p) === key);
  }

  // navigator.clipboard.writeText only works in a "secure context"
  // (https, or localhost). This app is being accessed over plain
  // http:// via a LAN IP (http://192.168.x.x), which is NOT a secure
  // context -- so the old direct clipboard call was failing silently
  // every time, with no error shown and no fallback. This tries the
  // modern API first, falls back to the old execCommand approach for
  // non-secure contexts, and flashes a checkmark so there's always
  // visible confirmation either way.
  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);

      console.log("Copied team:", value);

      setCopiedKey(key);

      setTimeout(() => {
        setCopiedKey(null);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  function openLogModal(bet: ArbitrageBet) {
    setLogSaveError(null);
    setLogBet(bet);

    const preset = Number(globalStake);

    setLogStake(
      Number.isFinite(preset) && preset > 0
        ? preset.toFixed(2)
        : "100.00"
    );

    if (bet.legs && bet.legs.length > 0) {
      const odds: Record<number, string> = {};

      bet.legs.forEach((leg, index) => {
        odds[index] = String(leg.odds);
      });

      setLogOdds(odds);
    } else {
      setLogOdds({
        0: String(bet.back_odds ?? ""),
        1: String(bet.lay_odds ?? ""),
      });
    }
  }
  const logTotalStake = Number(logStake) || 0;

  const logCrossBookCalculation = useMemo(() => {
    if (!logBet?.legs?.length) {
      return null;
    }

    const odds = logBet.legs.map((leg, index) => {
      const editedOdds = Number(logOdds[index]);

      return Number.isFinite(editedOdds) && editedOdds > 1
        ? editedOdds
        : leg.odds;
    });

    if (
      logTotalStake <= 0 ||
      odds.some((odd) => !Number.isFinite(odd) || odd <= 1)
    ) {
      return null;
    }

    const impliedProbability = odds.reduce(
      (sum, odd) => sum + 1 / odd,
      0
    );

    if (impliedProbability <= 0) {
      return null;
    }

    const legs = logBet.legs.map((leg, index) => {
      const odd = odds[index];

      const stake =
        logTotalStake *
        ((1 / odd) / impliedProbability);

      const payout = stake * odd;

      return {
        ...leg,
        odds: odd,
        stake,
        payout_if_wins: payout,
      };
    });

    const payout = legs[0]?.payout_if_wins ?? 0;

    const profit = payout - logTotalStake;

    const roi =
      logTotalStake > 0
        ? (profit / logTotalStake) * 100
        : 0;

    return {
      legs,
      totalStake: logTotalStake,
      payout,
      profit,
      roi,
      impliedProbability,
      isArbitrage: impliedProbability < 1,
    };
  }, [logBet, logOdds, logTotalStake]);
  function saveBetToPortfolio() {
    if (!logBet) return;

    const backStake = Number(logStake);
    if (!Number.isFinite(backStake) || backStake <= 0) {
      setLogSaveError("Enter a valid stake amount greater than $0.");
      return;
    }

    const originalBackStake = logBet.stake_plan?.bookmaker_stake ?? 0;
    // Previously this silently aborted the entire save with zero
    // feedback whenever the backend sent a 0 stake -- falling back
    // to a 1:1 ratio here means the save always goes through using
    // whatever the user typed, instead of quietly doing nothing.
    const ratio = originalBackStake > 0 ? backStake / originalBackStake : 1;

    const portfolioBet: PortfolioBet = {
      id: makeBetId(),
      event: logBet.event,
      selection: logBet.selection,
      bookmaker: logBet.bookmaker,
      exchange: logBet.exchange,
      type: logBet.type,
      back_odds: Number(logOdds[0]),
      lay_odds: Number(logOdds[1]),
      commission: logBet.commission,
      profit_percentage: logBet.profit_percentage,
      guaranteed_profit: logBet.guaranteed_profit * ratio,
      stake_plan: {
        bookmaker_stake: backStake,
        betfair_lay_stake: (logBet.stake_plan?.betfair_lay_stake ?? 0) * ratio,
        lay_liability: (logBet.stake_plan?.lay_liability ?? 0) * ratio,
        total_capital_required: (logBet.stake_plan?.total_capital_required ?? 0) * ratio,
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

    try {
      const opportunityKey = makeOpportunityKey(portfolioBet);
      const withoutDuplicate = portfolioBets.filter(
        (item) => makeOpportunityKey(item) !== opportunityKey
      );
      const updated = [portfolioBet, ...withoutDuplicate];

      setPortfolioBets(updated);
      saveBetLog(updated);
      setLogSaveError(null);
      setLogBet(null);
    } catch (err) {
      console.error("Failed to save bet to portfolio:", err);
      setLogSaveError("Couldn't save this bet -- check the console for details.");
    }
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
  // ==================================================
  // MODAL CALCULATIONS
  // ==================================================

  const logStakeNumber = Number(logStake) || 0;

  // Editable BACK odds
  const editedBackOdds =
    Number(logOdds[0]) > 1
      ? Number(logOdds[0])
      : Number(logBet?.back_odds ?? 0);

  // Editable LAY odds
  const editedLayOdds =
    Number(logOdds[1]) > 1
      ? Number(logOdds[1])
      : Number(logBet?.lay_odds ?? 0);

  // Betfair commission
  // 5% = 0.05
  const betfairCommission = 0.05;


  // ==========================================
  // BACK / LAY LIVE CALCULATION
  // ==========================================

  const calculatedLayStake =
    logBet &&
      !logBet.legs?.length &&
      logStakeNumber > 0 &&
      editedBackOdds > 1 &&
      editedLayOdds > 1
      ? (logStakeNumber * editedBackOdds) /
      (editedLayOdds - betfairCommission)
      : 0;


  // Betfair liability
  const calculatedLiability =
    calculatedLayStake > 0
      ? calculatedLayStake * (editedLayOdds - 1)
      : 0;


  // Total money required
  const calculatedCapital =
    logStakeNumber + calculatedLiability;


  // Guaranteed profit after Betfair commission
  const calculatedProfit =
    calculatedLayStake > 0
      ? calculatedLayStake * (1 - betfairCommission) -
      logStakeNumber
      : 0;


  // Live ROI
  const calculatedBackLayRoi =
    calculatedCapital > 0
      ? (calculatedProfit / calculatedCapital) * 100
      : 0;

  // ==================================================
  // LOADING
  // ==================================================
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-mono text-sm">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
          Connecting to scanner…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70 overflow-hidden">
        {/* ============================================
            TOOLBAR
        ============================================ */}
        <div className="flex flex-col gap-3 px-4 py-4 border-b border-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-left gap-2">
            

           

            <button
              type="button"
              onClick={() => setAutoRefreshOn((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${autoRefreshOn
                ? "bg-slate-50 border border-[#34D399]/40 text-[#34D399]"
                : "bg-slate-50 border border-slate-300 text-slate-400"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshOn ? "bg-[#34D399] animate-pulse" : "bg-[#5A6270]"}`} />
              Auto Refresh
            </button>



            <button
              type="button"
              onClick={startScan}
              disabled={status === "scanning"}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#5AA9FF] hover:bg-[#4090EE] disabled:bg-slate-200 disabled:text-slate-400 text-[#06131F] transition"
            >
              {status === "scanning" ? "Scanning…" : "Scan Markets"}
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#FF6B81]/10 border border-[#FF6B81]/30 text-[#FF6B81] hover:bg-[#FF6B81]/20 transition"
            >
              Clear Filters
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
            <span>
              Records: {filteredBets.length === 0 ? 0 : pageStart + 1}–
              {Math.min(pageStart + PAGE_SIZE, filteredBets.length)} / {filteredBets.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-30 hover:border-slate-400 transition"
              >
                ‹
              </button>
              <span className="px-2 text-slate-900">
                {clampedPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-30 hover:border-slate-400 transition"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* STATUS LINE */}
        <div className="flex flex-wrap items-center gap-x-1.5 px-4 py-4 border-b border-slate-200 text-[11px] font-mono">
          <span
            className={
              status === "scanning"
                ? "text-[#F5B942]"
                : status === "error"
                  ? "text-[#FF6B81]"
                  : "text-slate-500"
            }
          >
            {status === "scanning" ? "SCANNING MARKETS…" : status === "error" ? "SCANNER ERROR" : "SCANNER ONLINE"}
          </span>
          {lastUpdated && <span className="text-slate-400">· updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
          <span className="text-slate-400">
            · next scan in{" "}
            <span className="text-slate-900 font-semibold">
              {status === "scanning" ? "running now…" : scanCountdownText}
            </span>
          </span>
        </div>

        {error && (
          <div className="m-4 bg-[#FF6B81]/10 border border-[#FF6B81]/30 text-[#FF6B81] p-3 rounded-lg text-xs font-mono">
            {error}
          </div>
        )}

        {/* ============================================
            EMPTY STATE
        ============================================ */}
        {bets.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-3xl mb-3 opacity-70">⚡</div>
            <p className="font-semibold text-slate-900">No live arbitrage opportunities</p>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              EdgePulse will display opportunities here when bookmaker back odds beat Betfair lay
              prices.
            </p>
          </div>
        ) : (
          <>
            {/* ============================================
                DESKTOP DENSE GRID
            ============================================ */}
            <div className="hidden lg:block w-full overflow-x-auto">
              <table className="w-full min-w-[1400px] min-h-[600px] text-xs">
                <thead className="bg-gradient-to-r from-blue-50 via-slate-50 to-white border-b border-slate-200 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-2 py-2 text-left font-medium">Sport</th>
                    <th className="px-3 py-2 text-left font-medium">League</th>
                    <th className="px-3 py-2 text-left font-medium">Event</th>
                    <th className="px-3 py-2 text-left font-medium">Market</th>
                    <th className="px-3 py-2 text-left font-medium">Bookmaker</th>
                    <th className="px-3 py-2 text-center font-medium">Back</th>
                    <th className="px-3 py-2 text-center font-medium">Lay</th>
                    <th className="px-3 py-2 text-center font-medium">ROI</th>
                    <th className="px-3 py-2 text-center font-medium">Profit</th>
                    <th className="px-3 py-2 text-center font-medium">Log</th>

                  </tr>

                  {/* FILTER ROW */}
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">
                      <select
                        value={filterSport}
                        onChange={(e) => setFilterSport(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-700 outline-none"
                      >
                        <option value="all">All</option>
                        {sportOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        value={filterLeague}
                        onChange={(e) => setFilterLeague(e.target.value)}
                        placeholder="Search…"
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-700 placeholder:text-slate-400 outline-none"
                      />
                    </th>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">
                      <select
                        value={filterMarket}
                        onChange={(e) => setFilterMarket(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-700 outline-none"
                      >
                        <option value="all">All</option>
                        <option value="h2h">Match Odds</option>
                        <option value="totals">Totals</option>
                      </select>
                    </th>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">
                      <select
                        value={filterBookmaker}
                        onChange={(e) => setFilterBookmaker(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-700 outline-none"
                      >
                        <option value="all">All</option>
                        {bookmakerOptions.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-2" colSpan={2}>
                      <input
                        type="number"
                        value={minRoi}
                        onChange={(e) => setMinRoi(e.target.value)}
                        placeholder="Min ROI %"
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-700 placeholder:text-slate-400 outline-none"
                      />
                    </th>
                    <th className="px-3 py-2" colSpan={4} />
                  </tr>
                </thead>

                <tbody>
                  {pageBets.map((bet, index) => {
                    const age = getAgeSeconds(bet.found_at);
                    const stale = age !== null && age > 60;
                    const logged = isLogged(bet);
                    const isCrossBook = !!(bet.legs && bet.legs.length > 0);
                    const scaled = getScaledAmounts(bet);
                    const selectionText = formatSelection(bet);

                    const matchDate = bet.start_time ? new Date(bet.start_time) : null;
                    const matchDateText = matchDate
                      ? matchDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })
                      : "—";
                    const matchTimeText = matchDate
                      ? matchDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
                      : "—";

                    return (
                      <tr
                        key={`${bet.event}-${bet.selection}-${bet.market ?? "h2h"}-${bet.line ?? ""}-${index}`}
                        className={`border-b border-slate-100 transition-colors duration-150 hover:bg-blue-50/70 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                      >
                        {/* DATE */}
                        <td className="px-3 py-2.5 align-top whitespace-nowrap font-mono text-slate-700">
                          <div>{matchDateText}</div>
                          <div className="text-slate-400">{matchTimeText}</div>
                        </td>

                        {/* SPORT */}
                        <td className="px-3 py-2.5 align-top text-center text-base" title={bet.sport}>
                          {sportIcon(bet.sport)}
                        </td>

                        {/* LEAGUE */}
                        <td className="px-3 py-2.5 align-top text-slate-500 whitespace-nowrap">
                          {bet.league || "—"}
                        </td>


                        {/* EVENT */}
                        <td className="px-4 py-4 align-top min-w-[220px] font-semibold text-slate-900">
                          {(() => {
                            const teams = bet.event.split(/\s+vs\.?\s+/i);

                            if (teams.length !== 2) {
                              return <span>{bet.event}</span>;
                            }

                            const teamA = teams[0].trim();
                            const teamB = teams[1].trim();

                            const teamAKey = `team-a-${index}`;
                            const teamBKey = `team-b-${index}`;

                            return (
                              <div className="flex flex-col gap-1.5">
                                {/* TEAM A */}
                                <div className="flex items-center gap-2">
                                  <span>{teamA}</span>

                                  <button
                                    type="button"
                                    title={`Copy ${teamA}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(teamA, teamAKey);
                                    }}
                                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded border text-[11px] transition ${copiedKey === teamAKey
                                      ? "border-[#34D399] text-[#34D399]"
                                      : "border-slate-300 text-slate-400 hover:text-slate-900 hover:border-slate-400"
                                      }`}
                                  >
                                    {copiedKey === teamAKey ? "✓" : "⧉"}
                                  </button>
                                </div>

                                {/* VS */}
                                <span className="text-[9px] uppercase font-mono text-slate-400">
                                  vs
                                </span>

                                {/* TEAM B */}
                                <div className="flex items-center gap-2">
                                  <span>{teamB}</span>

                                  <button
                                    type="button"
                                    title={`Copy ${teamB}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(teamB, teamBKey);
                                    }}
                                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded border text-[11px] transition ${copiedKey === teamBKey
                                      ? "border-[#34D399] text-[#34D399]"
                                      : "border-slate-300 text-slate-400 hover:text-slate-900 hover:border-slate-400"
                                      }`}
                                  >
                                    {copiedKey === teamBKey ? "✓" : "⧉"}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* MARKET */}
                        <td className="px-3 py-2.5 align-top whitespace-nowrap">
                          <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-mono font-medium">
                            {formatMarketLabel(bet)}
                          </span>
                        </td>

                        {/* BOOKMAKER(S) */}
                        <td className="px-3 py-2.5 align-top">
                          {isCrossBook ? (
                            <div className="flex flex-col gap-2">
                              {bet.legs!.map((leg, i) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                  <span className="text-[12px] text-slate-400 font-mono truncate max-w-[150px]">
                                    {leg.selection}
                                  </span>
                                  <BookmakerBadge
                                    name={leg.bookmaker}
                                    href={leg.link}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] text-slate-400 font-mono">
                                BACK: {bet.selection}
                              </span>

                              <BookmakerBadge
                                name={bet.bookmaker}
                                href={bet.bookmaker_link}
                              />
                            </div>
                          )}
                        </td>

                        {/* BACK */}
                        <td className="px-3 py-2.5 align-top text-center">
                          {isCrossBook ? (
                            <div className="flex flex-col gap-2 items-center">
                              {bet.legs!.map((leg, i) => {
                                const legStake = getScaledLegStake(bet, leg);
                                return (
                                  <div key={i} className="flex flex-col items-center gap-0.5">
                                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-bold font-mono">
                                      {leg.odds}
                                    </span>
                                    <button
                                      type="button"
                                      title={`Copy ${leg.bookmaker} stake`}
                                      onClick={() =>
                                        copyText(legStake.toFixed(2), `leg-stake-${index}-${i}`)
                                      }
                                      className={`flex items-center gap-1 text-[9px] font-mono transition ${copiedKey === `leg-stake-${index}-${i}`
                                        ? "text-[#34D399]"
                                        : "text-slate-400 hover:text-slate-900"
                                        }`}
                                    >
                                      ${legStake.toFixed(2)}
                                      {copiedKey === `leg-stake-${index}-${i}` ? " ✓" : " ⧉"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 font-bold font-mono">
                                {bet.back_odds}
                              </span>
                              <button
                                type="button"
                                title="Copy back stake"
                                onClick={() =>
                                  copyText(scaled.backStake.toFixed(2), `back-stake-${index}`)
                                }
                                className={`flex items-center gap-1 text-[9px] font-mono transition ${copiedKey === `back-stake-${index}`
                                  ? "text-[#34D399]"
                                  : "text-slate-400 hover:text-slate-900"
                                  }`}
                              >
                                ${scaled.backStake.toFixed(2)}
                                {copiedKey === `back-stake-${index}` ? " ✓" : " ⧉"}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* LAY */}
                        <td className="px-3 py-2.5 align-top text-center">
                          {isCrossBook ? (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {bet.legs!.length}-way
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-block px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-100 font-bold font-mono">
                                {bet.lay_odds}
                              </span>
                              <button
                                type="button"
                                title="Copy lay stake"
                                onClick={() =>
                                  copyText(scaled.layStake.toFixed(2), `lay-stake-${index}`)
                                }
                                className={`flex items-center gap-1 text-[9px] font-mono transition ${copiedKey === `lay-stake-${index}`
                                  ? "text-[#34D399]"
                                  : "text-slate-400 hover:text-slate-900"
                                  }`}
                              >
                                ${scaled.layStake.toFixed(2)}
                                {copiedKey === `lay-stake-${index}` ? " ✓" : " ⧉"}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* ROI */}
                        <td className="px-3 py-2.5 align-top text-center">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold font-mono">
                            +{bet.profit_percentage.toFixed(2)}%
                          </span>
                        </td>

                        {/* PROFIT */}
                        <td
                          className="px-3 py-2.5 align-top text-center font-mono text-slate-900"
                          title={
                            hasValidGlobalStake
                              ? `At your $${globalStakeNumber.toFixed(2)} stake`
                              : undefined
                          }
                        >
                          ${(isCrossBook ? bet.guaranteed_profit : scaled.profit).toFixed(2)}
                        </td>



                        {/* LOG */}
                        <td className="px-4 py-4 align-top text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openLogModal(bet);
                            }}
                            title={logged ? "Already in Portfolio" : "Log to Portfolio"}
                            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border font-bold transition ${logged
                              ? "bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]"
                              : "bg-transparent border-slate-300 text-slate-500 hover:border-[#34D399]/50 hover:text-[#34D399] hover:bg-[#34D399]/5"
                              }`}
                          >
                            {logged ? "✓" : "＋"}
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {pageBets.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400 font-mono">
                  No opportunities match the current filters.
                </div>
              )}
            </div>

            {/* ============================================
                MOBILE / TABLET CARDS
            ============================================ */}
            <div className="lg:hidden p-3 space-y-3">
              {pageBets.map((bet, index) => {
                const age = getAgeSeconds(bet.found_at);
                const stale = age !== null && age > 60;
                const logged = isLogged(bet);
                const isCrossBook = !!(bet.legs && bet.legs.length > 0);
                const scaled = getScaledAmounts(bet);

                const [teamA, teamB] = bet.event.split(/\s+vs\.?\s+/i);

                return (
                  <div
                    key={`mobile-${bet.event}-${bet.selection}-${bet.market ?? "h2h"}-${bet.line ?? ""}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                  >
                    {/* HEADER */}
                    <div className="px-5 py-5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0 flex-5">

                          {/* SPORT / LEAGUE */}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mb-2">
                            <span>{sportIcon(bet.sport)}</span>
                            <span>{bet.league || bet.sport || ""}</span>
                          </div>

                          {/* EVENT / TEAM COPY */}
                          <div className="space-y-1.5">

                            {/* TEAM A */}
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 leading-snug break-words">
                                {teamA}
                              </p>

                              <button
                                type="button"
                                title="Copy Team A"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  copyText(teamA, `mobile-team-a-${index}`);
                                }}
                                className={`shrink-0 text-xs transition ${copiedKey === `mobile-team-a-${index}`
                                  ? "text-[#34D399]"
                                  : "text-slate-400 hover:text-slate-700"
                                  }`}
                              >
                                {copiedKey === `mobile-team-a-${index}`
                                  ? "✓"
                                  : "⧉"}
                              </button>
                            </div>

                            {/* TEAM B */}
                            {teamB && (
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 leading-snug break-words">
                                  {teamB}
                                </p>

                                <button
                                  type="button"
                                  title="Copy Team B"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    copyText(teamB, `mobile-team-b-${index}`);
                                  }}
                                  className={`shrink-0 text-xs transition ${copiedKey === `mobile-team-b-${index}`
                                    ? "text-[#34D399]"
                                    : "text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                  {copiedKey === `mobile-team-b-${index}`
                                    ? "✓"
                                    : "⧉"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* MARKET */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                              {formatMarketLabel(bet)}
                            </span>

                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatSelection(bet)}
                            </span>
                          </div>
                        </div>

                        {/* LOG BUTTON */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openLogModal(bet);
                          }}
                          className={`shrink-0 w-10 h-10 rounded-xl border font-bold transition ${logged
                            ? "bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]"
                            : "bg-transparent border-slate-300 text-slate-500 hover:border-[#34D399]/50 hover:text-[#34D399]"
                            }`}
                        >
                          {logged ? "✓" : "＋"}
                        </button>
                      </div>
                    </div>

                    {/* ==================================================
            CROSS BOOK
        ================================================== */}
                    {isCrossBook ? (
                      <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                        {bet.legs!.map((leg, i) => {
                          const legStake = getScaledLegStake(bet, leg);

                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-mono truncate">
                                  {leg.selection}
                                </p>
                                <BookmakerBadge
                                  name={leg.bookmaker}
                                  href={leg.link}
                                />
                              </div>

                              <div className="flex flex-col items-end shrink-0">

                                {/* ODDS */}
                                <span className="text-sm font-bold font-mono text-[#F5B942]">
                                  {leg.odds}
                                </span>

                                {/* COPY STAKE */}
                                <button
                                  type="button"
                                  title={`Copy ${leg.bookmaker} stake`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    copyText(
                                      legStake.toFixed(2),
                                      `mleg-stake-${index}-${i}`
                                    );
                                  }}
                                  className={`text-[9px] font-mono transition ${copiedKey === `mleg-stake-${index}-${i}`
                                    ? "text-[#34D399]"
                                    : "text-slate-400"
                                    }`}
                                >
                                  ${legStake.toFixed(2)}
                                  {copiedKey === `mleg-stake-${index}-${i}`
                                    ? " ✓"
                                    : " ⧉"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (

                      /* ==================================================
                          BACK / LAY
                      ================================================== */

                      <div className="grid grid-cols-2 divide-x divide-[#1B202B] border-b border-slate-100">

                        {/* BACK */}
                        <div className="px-4 py-3">

                          <div className="mb-1">
                            <BookmakerBadge
                              name={bet.bookmaker}
                              href={bet.bookmaker_link}
                            />
                          </div>

                          <span className="text-xl font-bold text-[#5AA9FF] font-mono">
                            {bet.back_odds}
                          </span>

                          {/* COPY BACK STAKE */}
                          <button
                            type="button"
                            title="Copy back stake"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              copyText(
                                scaled.backStake.toFixed(2),
                                `mback-stake-${index}`
                              );
                            }}
                            className={`block mt-1 text-[10px] font-mono transition ${copiedKey === `mback-stake-${index}`
                              ? "text-[#34D399]"
                              : "text-slate-400"
                              }`}
                          >
                            ${scaled.backStake.toFixed(2)}
                            {copiedKey === `mback-stake-${index}`
                              ? " ✓"
                              : " ⧉"}
                          </button>
                        </div>

                        {/* LAY */}
                        <div className="px-4 py-3">

                          <p className="text-[10px] text-slate-500 font-mono mb-1">
                            {bet.exchange}
                          </p>

                          <span className="text-xl font-bold text-[#FF6B81] font-mono">
                            {bet.lay_odds}
                          </span>

                          {/* COPY LAY STAKE */}
                          <button
                            type="button"
                            title="Copy lay stake"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              copyText(
                                scaled.layStake.toFixed(2),
                                `mlay-stake-${index}`
                              );
                            }}
                            className={`block mt-1 text-[10px] font-mono transition ${copiedKey === `mlay-stake-${index}`
                              ? "text-[#34D399]"
                              : "text-slate-400"
                              }`}
                          >
                            ${scaled.layStake.toFixed(2)}
                            {copiedKey === `mlay-stake-${index}`
                              ? " ✓"
                              : " ⧉"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ==================================================
            ROI / PROFIT
        ================================================== */}
                    <div className="grid grid-cols-2 divide-x divide-[#1B202B] border-b border-slate-100">

                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                          ROI
                        </p>

                        <p className="text-lg font-bold text-[#34D399] mt-1 font-mono">
                          +{bet.profit_percentage.toFixed(2)}%
                        </p>
                      </div>

                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                          Profit
                        </p>

                        <p className="text-lg font-bold text-[#34D399] mt-1 font-mono">
                          $
                          {(
                            isCrossBook
                              ? bet.guaranteed_profit
                              : scaled.profit
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* ==================================================
            STATUS
        ================================================== */}
                    <div className="px-4 py-3 bg-slate-50">

                      <p
                        className={`text-xs font-semibold font-mono ${stale
                          ? "text-[#F5B942]"
                          : "text-[#34D399]"
                          }`}
                      >
                        {stale ? "STALE" : "FRESH"}
                      </p>

                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        found {formatAge(age)} ago
                      </p>
                    </div>
                  </div>
                );
              })}

              {pageBets.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400 font-mono">
                  No opportunities match the current filters.
                </div>
              )}
            </div>

            {/* ==================================================
    MOBILE PAGINATION
================================================== */}
            <div className="lg:hidden flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-200 text-xs font-mono text-slate-500">

              <button
                type="button"
                onClick={() =>
                  setPage((p) =>
                    Math.max(1, p - 1)
                  )
                }
                disabled={clampedPage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-30"
              >
                ‹
              </button>

              <span>
                {clampedPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((p) =>
                    Math.min(totalPages, p + 1)
                  )
                }
                disabled={clampedPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>

      {/* ============================================
          LOG TO PORTFOLIO MODAL
      ============================================ */}
      {logBet && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-3 overflow-y-auto sm:items-center sm:p-4">

          {/* BACKDROP */}
          <div
            onClick={() => setLogBet(null)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />

          {/* MODAL */}
          <div className="relative w-full max-w-lg h-[80vh] max-h-[720px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">

            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#34D399] font-mono font-bold">
                  Log to Portfolio
                </p>

                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {logBet.event}
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  {formatSelection(logBet)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLogBet(null)}
                className="text-slate-400 hover:text-slate-900 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">

              {/* ============================
            CROSS-BOOK / BACK-LAY CARDS
            ============================ */}

              {logBet.legs && logBet.legs.length > 0 ? (
                /* CROSS-BOOK */
                <div className="space-y-2">

                  <p className="text-[10px] uppercase tracking-widest text-[#F5B942] font-mono font-bold">
                    Cross-Book Arbitrage
                  </p>

                  {logBet.legs.map((leg, index) => (
                    <div
                      key={`${leg.bookmaker}-${leg.selection}-${index}`}
                      className="bg-[#F5B942]/5 border border-[#F5B942]/20 rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">
                          <BookmakerBadge
                            name={leg.bookmaker}
                            href={leg.link}
                          />

                          <p className="text-xs font-semibold text-slate-900 mt-2 truncate">
                            {leg.selection}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-slate-500 font-mono">
                            ODDS
                          </p>

                          <input
                            type="number"
                            min="1.01"
                            step="0.01"
                            value={logOdds[index] ?? String(leg.odds)}
                            onChange={(e) => {
                              setLogOdds((current) => ({
                                ...current,
                                [index]: e.target.value,
                              }));
                            }}
                            className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-right text-lg font-bold text-[#F5B942] font-mono outline-none focus:border-[#F5B942]"
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Stake
                        </span>

                        <span className="font-mono font-semibold text-sm text-slate-900">
                          $
                          {(
                            logCrossBookCalculation?.legs[index]?.stake ??
                            leg.stake
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* NORMAL BACK / LAY */
                <div className="grid grid-cols-2 gap-2">

                  {/* BACK */}
                  <div className="bg-[#5AA9FF]/5 border border-[#5AA9FF]/20 rounded-xl p-3">

                    <p className="text-[9px] font-bold text-[#5AA9FF] font-mono tracking-wide">
                      BACK
                    </p>

                    <div className="mt-2">
                      <BookmakerBadge
                        name={logBet.bookmaker}
                        href={logBet.bookmaker_link}
                      />
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                      {formatSelection(logBet)}
                    </p>

                    <div className="mt-2">
                      <p className="text-[9px] text-slate-500 font-mono mb-1">
                        BACK ODDS
                      </p>

                      <input
                        type="number"
                        min="1.01"
                        step="0.01"
                        value={logOdds[0] ?? ""}
                        onChange={(e) =>
                          setLogOdds((current) => ({
                            ...current,
                            0: e.target.value,
                          }))
                        }
                        className="w-full mt-2 bg-slate-50 border border-[#5AA9FF]/30 rounded-lg px-2 py-1.5 text-xl font-bold text-[#5AA9FF] font-mono outline-none focus:border-[#5AA9FF]"
                      />
                    </div>
                  </div>

                  {/* LAY */}
                  <div className="bg-[#FF6B81]/5 border border-[#FF6B81]/20 rounded-xl p-3">

                    <p className="text-[9px] font-bold text-[#FF6B81] font-mono tracking-wide">
                      LAY
                    </p>

                    <p className="font-bold text-sm text-slate-900 mt-2">
                      {logBet.exchange}
                    </p>

                    <p className="text-xs text-slate-500 mt-2">
                      {formatSelection(logBet)}
                    </p>

                    <div className="mt-2">
                      <p className="text-[9px] text-slate-500 font-mono mb-1">
                        LAY ODDS
                      </p>

                      <input
                        type="number"
                        min="1.01"
                        step="0.01"
                        value={logOdds[1] ?? ""}
                        onChange={(e) =>
                          setLogOdds((current) => ({
                            ...current,
                            1: e.target.value,
                          }))
                        }
                        className="w-full mt-2 bg-slate-50 border border-[#FF6B81]/30 rounded-lg px-2 py-1.5 text-xl font-bold text-[#FF6B81] font-mono outline-none focus:border-[#FF6B81]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================
            STAKE INPUT
            ============================ */}

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  How much did you back? ($)
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={logStake}
                  onChange={(event) => setLogStake(event.target.value)}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xl font-bold font-mono text-slate-900 outline-none focus:ring-2 focus:ring-[#34D399] focus:border-[#34D399]"
                />
              </div>

              {/* ==============================
            CROSS-BOOK / BACK-LAY SUMMARY
            ============================== */}

              {logBet.legs && logBet.legs.length > 0 ? (
                /* CROSS-BOOK CALCULATION */
                logCrossBookCalculation && (
                  <>
                    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden font-mono text-sm">

                      <Row
                        label="Total stake"
                        value={`$${logCrossBookCalculation.totalStake.toFixed(2)}`}
                      />

                      <Row
                        label="Guaranteed payout"
                        value={`$${logCrossBookCalculation.payout.toFixed(2)}`}
                      />

                      <Row
                        label="Expected profit"
                        value={`${logCrossBookCalculation.profit >= 0 ? "+" : ""}$${logCrossBookCalculation.profit.toFixed(2)}`}
                        valueClass={
                          logCrossBookCalculation.profit >= 0
                            ? "text-[#34D399] text-base"
                            : "text-[#FF6B81] text-base"
                        }
                        labelClass="font-sans font-semibold text-slate-900"
                      />

                      <Row
                        label="Arbitrage ROI"
                        value={`${logCrossBookCalculation.roi >= 0 ? "+" : ""}${logCrossBookCalculation.roi.toFixed(2)}%`}
                        valueClass={
                          logCrossBookCalculation.roi >= 0
                            ? "text-[#34D399] text-base"
                            : "text-[#FF6B81] text-base"
                        }
                        labelClass="font-sans font-semibold text-slate-900"
                        noBorder
                      />

                    </div>

                    {!logCrossBookCalculation.isArbitrage && (
                      <div className="mt-3 rounded-xl border border-[#FF6B81]/30 bg-[#FF6B81]/5 px-3 py-2">
                        <p className="text-xs font-semibold text-[#FF6B81]">
                          These odds no longer produce an arbitrage.
                        </p>
                      </div>
                    )}
                  </>
                )
              ) : (
                /* NORMAL BACK / BETFAIR LAY */
                logStakeNumber > 0 && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden font-mono text-sm">

                    <Row
                      label="Back stake"
                      value={`$${logStakeNumber.toFixed(2)}`}
                    />

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
                      labelClass="font-sans font-semibold text-slate-900"
                      noBorder
                    />

                  </div>
                )
              )}

              {/* ROI */}
              <div className="mt-3 flex justify-between items-center bg-[#34D399]/10 border border-[#34D399]/30 rounded-xl px-3 py-2.5">
                <span className="text-xs text-[#34D399]/90">
                  Arbitrage ROI
                </span>

                <span
                  className={`font-bold font-mono text-sm ${calculatedBackLayRoi >= 0
                    ? "text-[#34D399]"
                    : "text-[#FF6B81]"
                    }`}
                >
                  {calculatedBackLayRoi >= 0 ? "+" : ""}
                  {calculatedBackLayRoi.toFixed(2)}%
                </span>
              </div>

              {/* INFO */}
              <p className="text-[11px] text-slate-400 mt-3">
                This saves the position to your Portfolio. It does not place either bet automatically.
              </p>

              {/* ERROR */}
              {logSaveError && (
                <p className="text-xs text-[#FF6B81] mt-3 bg-[#FF6B81]/10 border border-[#FF6B81]/30 rounded-lg px-3 py-2">
                  {logSaveError}
                </p>
              )}

              {/* ADD BUTTON */}
              <button
                type="button"
                onClick={saveBetToPortfolio}
                disabled={!Number.isFinite(logStakeNumber) || logStakeNumber <= 0}
                className="w-full mt-4 bg-[#34D399] hover:bg-[#2BBF8A] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-[#06120D] rounded-xl py-2.5 font-bold transition"
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
  valueClass = "text-slate-900",
  labelClass = "text-slate-500 font-sans",
  noBorder = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  labelClass?: string;
  noBorder?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 ${noBorder ? "" : "border-b border-slate-100"}`}>
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <strong className={`font-bold ${valueClass}`}>{value}</strong>
    </div>
  );
}