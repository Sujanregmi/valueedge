import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import BetStats from "@/components/mybets/BetStats";
import BetCard from "@/components/mybets/BetCard";
import BetHistory from "@/components/mybets/BetHistory";


export default function MyBetsPage(){


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


{/* Header */}

<div>

<h1 className="
text-4xl
font-bold
">

My Bets

</h1>


<p className="
text-gray-500
mt-3
text-lg
">

Track and manage your betting performance

</p>

</div>




{/* Stats */}

<div className="mt-8">

<BetStats />

</div>





{/* Open Bets */}

<div className="mt-10">


<h2 className="
text-2xl
font-bold
mb-5
">

Open Bets

</h2>


<BetCard />


</div>





{/* History */}

<div className="mt-10">

<BetHistory />

</div>



</section>


</div>


</main>

);


}