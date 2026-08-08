"use client";

import { useState, useEffect } from "react";
import BetDetails from "@/components/valuebets/BetDetails";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import FilterBar from "@/components/valuebets/FilterBar";
import OddsTable from "@/components/valuebets/OddsTable";
import ScannerStats from "@/components/valuebets/ScannerStats";
import {getValueBets} from "@/lib/api";

export default function ValueBetsPage(){

const [selectedBet, setSelectedBet] = useState<any>(null);
const [bets, setBets] = useState<any[]>([]);
const [loading, setLoading] = useState(true);


useEffect(() => {

async function loadBets(){

const data = await getValueBets();

setBets(data);

setLoading(false);

}

loadBets();

}, []);



if (loading) {

return (
<div>
Loading...
</div>
);

}


// IMPORTANT
// Normal page return goes here

return (

<main className="min-h-screen bg-slate-100">

<Navbar />

<div className="flex">

<Sidebar />

<section className="flex-1 p-8">

<h1 className="text-3xl font-bold">
Value Scanner
</h1>


<OddsTable
 bets={bets}
 selectBet={setSelectedBet}
/>


</section>

</div>


<BetDetails
 bet={selectedBet}
 close={() => setSelectedBet(null)}
/>


</main>

);


}