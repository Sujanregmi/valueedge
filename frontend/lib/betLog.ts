export const BET_LOG_STORAGE_KEY =
  "edgepulse-bet-log";


export type BetStatus =
  | "open"
  | "settled"
  | "void";


export type BetResult =
  | "won"
  | "lost"
  | "push"
  | "void"
  | null;


export type StakePlan = {
  bookmaker_stake: number;
  betfair_lay_stake: number;
  lay_liability: number;
  total_capital_required: number;
};

export type PortfolioLeg = {
  selection: string;
  bookmaker: string;
  odds: number;
  stake: number;
  payout_if_wins: number;
  link?: string | null;
};

export type PortfolioBet = {
  id: string;

  event: string;
  selection: string;

  bookmaker: string;
  exchange: string;

  type: string;

  legs?: PortfolioLeg[] | null;

  back_odds: number;
  lay_odds: number;

  commission: number;

  profit_percentage: number;
  guaranteed_profit: number;

  stake_plan: StakePlan;

  status: BetStatus;
  result: BetResult;

  settled_profit: number | null;

  clv: number | null;

  found_at?: string;
  placed_at: string;

  start_time?: string | null;

  notes?: string;
};

export function makeBetId(): string {
  return (
    Date.now().toString() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}


function normalizeBetStatus(
  status: unknown
): BetStatus {
  if (status === "settled") {
    return "settled";
  }

  if (status === "void") {
    return "void";
  }

  return "open";
}


function normalizeBetResult(
  result: unknown
): BetResult {
  // Convert previously stored result names.
  if (result === "win") {
    return "won";
  }

  if (result === "loss") {
    return "lost";
  }

  if (
    result === "won" ||
    result === "lost" ||
    result === "push" ||
    result === "void"
  ) {
    return result;
  }

  return null;
}


export function loadBetLog(): PortfolioBet[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(
      BET_LOG_STORAGE_KEY
    );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(
      (
        bet: Partial<PortfolioBet> &
          Record<string, unknown>
      ): PortfolioBet => {
        const status =
          normalizeBetStatus(
            bet.status
          );

        const result =
          normalizeBetResult(
            bet.result
          );

        return {
          id:
            typeof bet.id === "string"
              ? bet.id
              : makeBetId(),

          event:
            typeof bet.event === "string"
              ? bet.event
              : "Unknown event",

          selection:
            typeof bet.selection === "string"
              ? bet.selection
              : "Unknown",

          bookmaker:
            typeof bet.bookmaker === "string"
              ? bet.bookmaker
              : "Unknown",

          exchange:
            typeof bet.exchange === "string"
              ? bet.exchange
              : "Betfair",

          type:
            typeof bet.type === "string"
              ? bet.type
              : "back_lay_arbitrage",

          legs:
            Array.isArray(bet.legs)
              ? bet.legs.map((leg: any) => ({
                selection:
                  typeof leg.selection === "string"
                    ? leg.selection
                    : "Unknown",

                bookmaker:
                  typeof leg.bookmaker === "string"
                    ? leg.bookmaker
                    : "Unknown",

                odds: Number(leg.odds ?? 0),

                stake: Number(leg.stake ?? 0),

                payout_if_wins: Number(
                  leg.payout_if_wins ?? 0
                ),

                link:
                  typeof leg.link === "string"
                    ? leg.link
                    : null,
              }))
              : null,

          back_odds:
            Number(
              bet.back_odds ?? 0
            ),

          lay_odds:
            Number(
              bet.lay_odds ?? 0
            ),

          commission:
            Number(
              bet.commission ?? 0.05
            ),

          profit_percentage:
            Number(
              bet.profit_percentage ?? 0
            ),

          guaranteed_profit:
            Number(
              bet.guaranteed_profit ?? 0
            ),

          stake_plan: {
            bookmaker_stake:
              Number(
                bet.stake_plan
                  ?.bookmaker_stake ?? 0
              ),

            betfair_lay_stake:
              Number(
                bet.stake_plan
                  ?.betfair_lay_stake ?? 0
              ),

            lay_liability:
              Number(
                bet.stake_plan
                  ?.lay_liability ?? 0
              ),

            total_capital_required:
              Number(
                bet.stake_plan
                  ?.total_capital_required ??
                0
              ),
          },

          status,
          result,

          settled_profit:
            bet.settled_profit == null
              ? null
              : Number(
                bet.settled_profit
              ),

          clv:
            bet.clv == null
              ? null
              : Number(bet.clv),

          found_at:
            typeof bet.found_at === "string"
              ? bet.found_at
              : undefined,

          placed_at:
            typeof bet.placed_at === "string"
              ? bet.placed_at
              : new Date().toISOString(),

          start_time:
            typeof bet.start_time === "string"
              ? bet.start_time
              : null,

          notes:
            typeof bet.notes === "string"
              ? bet.notes
              : "",
        };
      }
    );
  } catch {
    return [];
  }
}


export function saveBetLog(
  bets: PortfolioBet[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    BET_LOG_STORAGE_KEY,
    JSON.stringify(bets)
  );
}


export function calculatePendingExposure(
  bets: PortfolioBet[]
): number {
  return bets
    .filter(
      (bet) =>
        bet.status === "open"
    )
    .reduce(
      (total, bet) =>
        total +
        bet.stake_plan
          .total_capital_required,
      0
    );
}


export function calculateSettledProfit(
  bets: PortfolioBet[]
): number {
  return bets
    .filter(
      (bet) =>
        bet.status === "settled" ||
        bet.status === "void"
    )
    .reduce(
      (total, bet) =>
        total +
        (bet.settled_profit ?? 0),
      0
    );
}


export function calculateAverageClv(
  bets: PortfolioBet[]
): number | null {
  const graded = bets.filter(
    (bet) =>
      bet.status === "settled" &&
      bet.clv !== null
  );

  if (graded.length === 0) {
    return null;
  }

  const total = graded.reduce(
    (sum, bet) =>
      sum + (bet.clv ?? 0),
    0
  );

  return total / graded.length;
}


export function exportBetLogCsv(
  bets: PortfolioBet[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  const headers = [
    "Event",
    "Selection",
    "Bookmaker",
    "Exchange",
    "Back Odds",
    "Lay Odds",
    "Back Stake",
    "Lay Stake",
    "Liability",
    "Expected Profit",
    "ROI %",
    "Status",
    "Result",
    "Settled P/L",
    "CLV %",
    "Placed At",
  ];

  const rows = bets.map(
    (bet) => [
      bet.event,
      bet.selection,
      bet.bookmaker,
      bet.exchange,
      bet.back_odds,
      bet.lay_odds,
      bet.stake_plan.bookmaker_stake,
      bet.stake_plan.betfair_lay_stake,
      bet.stake_plan.lay_liability,
      bet.guaranteed_profit,
      bet.profit_percentage,
      bet.status,
      bet.result ?? "",
      bet.settled_profit ?? "",
      bet.clv ?? "",
      bet.placed_at,
    ]
  );

  const escapeCsv = (
    value: string | number
  ): string => {
    const stringValue =
      String(value ?? "");

    return (
      '"' +
      stringValue.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  };

  const csv = [
    headers
      .map(escapeCsv)
      .join(","),

    ...rows.map(
      (row) =>
        row
          .map(escapeCsv)
          .join(",")
    ),
  ].join("\n");

  const blob = new Blob(
    [csv],
    {
      type:
        "text/csv;charset=utf-8;",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `edgepulse-bet-log-${new Date()
      .toISOString()
      .slice(0, 10)
    }.csv`;

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}