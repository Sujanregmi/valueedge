type Bet = {
  event: string;
  sport: string;
  bookmaker: string;
  odds: string;
  fairOdds: string;
  edge: string;
};


export default function BetDetails({
  bet,
  close
}: {
  bet: Bet | null;
  close: () => void;
}) {


  if (!bet) return null;


  return (

    <div className="fixed inset-0 z-50 flex justify-end">


      {/* Background */}
      <div
        onClick={close}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />


      {/* Drawer */}
      <div className="
        relative
        w-full
        md:w-[420px]
        h-full
        bg-white
        shadow-2xl
        p-6
        animate-slide-in
      ">


        {/* Header */}

        <div className="flex justify-between items-center">


          <h2 className="text-xl font-bold flex items-center gap-2">
            ⚡ Bet Analysis
          </h2>


          <button
            onClick={close}
            className="text-gray-500 hover:text-black text-xl"
          >
            ✕
          </button>


        </div>



        {/* Match */}

        <div className="mt-8">


          <h1 className="text-2xl font-bold">
            {bet.event}
          </h1>


          <p className="text-gray-500 mt-1">
            {bet.sport}
          </p>


        </div>




        {/* Best Opportunity Card */}

        <div className="
          mt-6
          bg-slate-900
          text-white
          rounded-xl
          p-5
        ">


          <p className="text-sm text-gray-300">
            Best Opportunity
          </p>


          <div className="flex justify-between mt-3">


            <div>

              <p className="text-lg font-semibold">
                {bet.bookmaker}
              </p>

              <p className="text-sm text-gray-300">
                Best odds available
              </p>

            </div>


            <p className="text-3xl font-bold text-green-400">
              {bet.odds}
            </p>


          </div>


        </div>





        {/* Edge */}

        <div className="mt-6">


          <div className="flex justify-between">

            <p className="font-semibold">
              Edge Score
            </p>


            <p className="text-green-600 font-bold">
              {bet.edge}
            </p>

          </div>



          <div className="h-3 bg-gray-200 rounded-full mt-3">


            <div
              className="
              h-3
              bg-green-500
              rounded-full
              "
              style={{
                width:"70%"
              }}
            />


          </div>


        </div>





        {/* Stats */}

        <div className="
          grid
          grid-cols-2
          gap-4
          mt-6
        ">


          <div className="bg-gray-100 rounded-xl p-4">

            <p className="text-gray-500">
              Fair Odds
            </p>

            <p className="text-xl font-bold">
              {bet.fairOdds}
            </p>

          </div>



          <div className="bg-gray-100 rounded-xl p-4">

            <p className="text-gray-500">
              Expected Value
            </p>

            <p className="text-xl font-bold text-green-600">
              +12.5%
            </p>

          </div>


        </div>





        {/* Stake */}

        <div className="
          mt-6
          bg-green-50
          rounded-xl
          p-5
        ">


          <p className="text-gray-600">
            Recommended Stake
          </p>


          <p className="text-3xl font-bold">
            $25
          </p>


        </div>




        <button
          className="
          w-full
          mt-8
          bg-green-500
          hover:bg-green-600
          text-white
          py-3
          rounded-xl
          font-semibold
          "
        >
          Open Bet
        </button>



      </div>


    </div>

  );

}