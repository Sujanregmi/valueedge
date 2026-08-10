type Bet = {
  sport: string;
  event: string;
  selection: string;
  bookmaker: string;
  odds: number;
  fair_odds: number;
  edge: number;
};

export default function OddsTable({
  bets,
  selectBet
}: {
  bets: Bet[];
  selectBet: (bet: Bet)=>void;
})
{

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">

      <table className="w-full">

        <thead className="bg-slate-100">
          <tr>
             
            <th className="p-4 text-left">
              Event
            </th>
            <th className="p-4">
              Sport
            </th>
            <th className="p-4">
              Selection

            </th>
           
            <th className="p-4">
              Bookmaker
            </th>
           
            <th className="p-4">
              Odds
            </th>

            <th className="p-4">
              Fair Odds
            </th>

            <th className="p-4">
              Edge
            </th>

            <th className="p-4">
              Action
            </th>
          </tr>
        </thead>


        <tbody>

          {bets.map((bet, index) => (

            <tr key={index} className="border-t">

              <td className="p-4">
                {bet.event}
              </td>

              <td className="p-4 text-center">
                {bet.sport}
              </td>
              
              <td>
                {bet.selection}
              </td>

              <td className="p-4 text-center">
                {bet.bookmaker}
              </td>

              <td className="p-4 text-center">
                {bet.odds}
              </td>

              <td className="p-4 text-center">
                {bet.fair_odds}
              </td>

              <td className="p-4 text-center text-green-600 font-bold">
                {bet.edge}%
              </td>

              <td className="p-4 text-center">
              <button
  onClick={() => selectBet(bet)}
  className="
    group
    flex
    items-center
    gap-2
    mx-auto
    bg-green-500
    hover:bg-green-600
    text-white
    px-4
    py-2
    rounded-lg
    transition
    shadow-sm
  "
>

  <span>
    ⚡
  </span>

  <span>
    Analyze
  </span>

</button>
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}