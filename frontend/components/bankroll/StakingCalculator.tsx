"use client";

import { useState } from "react";


export default function StakingCalculator(){

  const [bankroll,setBankroll] = useState(1000);
  const [risk,setRisk] = useState(5);


  const stake = bankroll * (risk / 100);


  return (

    <div className="bg-white rounded-xl shadow p-6">


      <h2 className="text-xl font-bold">
        Staking Calculator
      </h2>


      <div className="mt-5 space-y-4">


        <div>

          <label className="text-gray-500">
            Bankroll
          </label>

          <input
            value={bankroll}
            onChange={(e)=>setBankroll(Number(e.target.value))}
            className="border p-3 rounded-lg w-full mt-2"
          />

        </div>



        <div>

          <label className="text-gray-500">
            Risk %
          </label>

          <input
            value={risk}
            onChange={(e)=>setRisk(Number(e.target.value))}
            className="border p-3 rounded-lg w-full mt-2"
          />

        </div>



        <div className="bg-green-50 p-4 rounded-lg">

          <p>
            Recommended Stake
          </p>

          <h2 className="text-3xl font-bold text-green-600">
            ${stake.toFixed(2)}
          </h2>

        </div>


      </div>


    </div>

  );

}