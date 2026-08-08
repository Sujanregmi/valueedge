import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import MarketFilters from "@/components/markets/MarketFilters";
import MarketCard from "@/components/markets/MarketCard";


export default function FootballMarkets(){


return (

<main className="
min-h-screen
bg-slate-100
">


<Navbar />


<div className="flex">


<Sidebar />


<section className="
flex-1
p-8
">


<h1 className="
text-4xl
font-bold
">

Football Markets

</h1>


<p className="
text-gray-500
mt-3
">

Find the best betting opportunities

</p>



<MarketFilters />



<div className="
mt-8
space-y-6
">


<MarketCard

event="Arsenal vs Chelsea"

time="Today • 20:00"

/>



<MarketCard

event="Liverpool vs Man City"

time="Tomorrow • 18:30"

/>



</div>


</section>


</div>


</main>

);

}