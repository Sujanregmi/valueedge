import {
  calculateAverageClv,
  calculatePendingExposure,
  calculateSettledProfit,
  type PortfolioBet,
} from "@/lib/betLog";


export default function PortfolioStats({
  bets,
}: {
  bets: PortfolioBet[];
}) {
  const netProfit =
    calculateSettledProfit(
      bets
    );

  const pendingExposure =
    calculatePendingExposure(
      bets
    );

  const settledBets =
    bets.filter(
      bet =>
        bet.status === "settled"
    ).length;

  const averageClv =
    calculateAverageClv(
      bets
    );

  const gradedClvCount =
    bets.filter(
      bet =>
        bet.status === "settled" &&
        bet.clv !== null
    ).length;


  return (
    <div className="
      grid
      grid-cols-1
      md:grid-cols-2
      xl:grid-cols-4
      gap-4
    ">


      <div className="
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-5
        shadow-sm
      ">
        <p className="
          text-sm
          text-slate-500
        ">
          Net P/L (settled)
        </p>

        <p
          className={`
            text-3xl
            font-bold
            mt-3
            ${
              netProfit >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          `}
        >
          {netProfit >= 0
            ? "+"
            : ""}
          $
          {netProfit.toFixed(2)}
        </p>
      </div>


      <div className="
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-5
        shadow-sm
      ">
        <p className="
          text-sm
          text-slate-500
        ">
          Pending exposure
        </p>

        <p className="
          text-3xl
          font-bold
          mt-3
          text-slate-900
        ">
          $
          {pendingExposure
            .toFixed(2)}
        </p>
      </div>


      <div className="
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-5
        shadow-sm
      ">
        <p className="
          text-sm
          text-slate-500
        ">
          Settled bets
        </p>

        <p className="
          text-3xl
          font-bold
          mt-3
          text-slate-900
        ">
          {settledBets}
        </p>
      </div>


      <div className="
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-5
        shadow-sm
      ">
        <p className="
          text-sm
          text-slate-500
        ">
          Avg CLV
          {gradedClvCount > 0 &&
            ` (${gradedClvCount} graded)`}
        </p>

        <p
          className={`
            text-3xl
            font-bold
            mt-3
            ${
              averageClv === null
                ? "text-slate-400"
                : averageClv >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          `}
        >
          {averageClv === null
            ? "—"
            : `${
                averageClv >= 0
                  ? "+"
                  : ""
              }${averageClv.toFixed(
                2
              )}%`}
        </p>
      </div>

    </div>
  );
}