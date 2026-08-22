export const BET_LOG_STORAGE_KEY =
  "edgepulse-bet-log";

export type BetStatus =
  | "open"
  | "settled";

export type BetResult =
  | "win"
  | "loss"
  | "push"
  | null;

export type StakePlan = {
  bookmaker_stake: number;
  betfair_lay_stake: number;
  lay_liability: number;
  total_capital_required: number;
};

export type PortfolioBet = {
  id: string;

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

  status: BetStatus;
  result: BetResult;

  settled_profit: number | null;

  clv: number | null;

  found_at?: string;
  placed_at: string;

  start_time?: string | null;

  notes?: string;
};


export function makeBetId() {
  return (
    Date.now().toString() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}


export function loadBetLog(): PortfolioBet[] {
  if (
    typeof window === "undefined"
  ) {
    return [];
  }

  try {
    const raw =
      localStorage.getItem(
        BET_LOG_STORAGE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(
      (bet: Partial<PortfolioBet>) => ({
        id:
          bet.id ??
          makeBetId(),

        event:
          bet.event ??
          "Unknown event",

        selection:
          bet.selection ??
          "Unknown",

        bookmaker:
          bet.bookmaker ??
          "Unknown",

        exchange:
          bet.exchange ??
          "Betfair",

        type:
          bet.type ??
          "back_lay_arbitrage",

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
                ?.bookmaker_stake ??
                0
            ),

          betfair_lay_stake:
            Number(
              bet.stake_plan
                ?.betfair_lay_stake ??
                0
            ),

          lay_liability:
            Number(
              bet.stake_plan
                ?.lay_liability ??
                0
            ),

          total_capital_required:
            Number(
              bet.stake_plan
                ?.total_capital_required ??
                0
            ),
        },

        status:
          bet.status === "settled"
            ? "settled"
            : "open",

        result:
          bet.result ??
          null,

        settled_profit:
          bet.settled_profit ??
          null,

        clv:
          bet.clv ??
          null,

        found_at:
          bet.found_at,

        placed_at:
          bet.placed_at ??
          new Date().toISOString(),

        start_time:
          bet.start_time ??
          null,

        notes:
          bet.notes ??
          "",
      })
    );

  } catch {
    return [];
  }
}


export function saveBetLog(
  bets: PortfolioBet[]
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    BET_LOG_STORAGE_KEY,
    JSON.stringify(bets)
  );
}


export function calculatePendingExposure(
  bets: PortfolioBet[]
) {
  return bets
    .filter(
      bet =>
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
) {
  return bets
    .filter(
      bet =>
        bet.status === "settled"
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
) {
  const graded =
    bets.filter(
      bet =>
        bet.status === "settled" &&
        bet.clv !== null
    );

  if (
    graded.length === 0
  ) {
    return null;
  }

  const total =
    graded.reduce(
      (sum, bet) =>
        sum +
        (bet.clv ?? 0),
      0
    );

  return (
    total /
    graded.length
  );
}


export function exportBetLogCsv(
  bets: PortfolioBet[]
) {
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

  const rows =
    bets.map(
      bet => [
        bet.event,
        bet.selection,
        bet.bookmaker,
        bet.exchange,
        bet.back_odds,
        bet.lay_odds,
        bet.stake_plan
          .bookmaker_stake,
        bet.stake_plan
          .betfair_lay_stake,
        bet.stake_plan
          .lay_liability,
        bet.guaranteed_profit,
        bet.profit_percentage,
        bet.status,
        bet.result ?? "",
        bet.settled_profit ?? "",
        bet.clv ?? "",
        bet.placed_at,
      ]
    );

  const escapeCsv =
    (
      value:
        string | number
    ) => {
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
      row =>
        row
          .map(escapeCsv)
          .join(",")
    ),
  ].join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    `edgepulse-bet-log-${
      new Date()
        .toISOString()
        .slice(0, 10)
    }.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}
