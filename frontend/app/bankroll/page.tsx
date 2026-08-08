import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import BankrollCard from "@/components/bankroll/BankrollCard";
import StakingCalculator from "@/components/bankroll/StakingCalculator";
import BetsTable from "@/components/bankroll/BetsTable";


export default function BankrollPage(){

  return (

    <main className="min-h-screen bg-slate-100">


      <Navbar />


      <div className="flex">


        <Sidebar />


        <section className="flex-1 p-8">


          <h1 className="text-3xl font-bold">
            Bankroll Management
          </h1>


          <p className="text-gray-500 mt-2">
            Track your betting performance and manage risk
          </p>



          {/* Top Cards */}

          <div className="grid md:grid-cols-3 gap-6 mt-8">


            <BankrollCard />


            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-gray-500">
                Total Profit
              </p>


              <h2 className="text-4xl font-bold mt-3 text-green-600">
                +$240
              </h2>


            </div>



            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-gray-500">
                ROI
              </p>


              <h2 className="text-4xl font-bold mt-3">
                12.5%
              </h2>


            </div>


          </div>





          {/* Calculator */}

          <div className="grid lg:grid-cols-2 gap-6 mt-8">


            <StakingCalculator />


            <div className="bg-white rounded-xl shadow p-6">


              <h2 className="text-xl font-bold">
                Risk Overview
              </h2>


              <div className="mt-6 space-y-4">


                <div className="flex justify-between">

                  <span>
                    Average Bet Size
                  </span>

                  <b>
                    $35
                  </b>

                </div>



                <div className="flex justify-between">

                  <span>
                    Winning Rate
                  </span>

                  <b>
                    62%
                  </b>

                </div>



                <div className="flex justify-between">

                  <span>
                    Largest Drawdown
                  </span>

                  <b>
                    -8%
                  </b>

                </div>


              </div>


            </div>


          </div>





          {/* Bet History */}

          <div className="mt-8">

            <BetsTable />

          </div>



        </section>


      </div>


    </main>

  );

}