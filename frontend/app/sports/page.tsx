import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import SportCard from "@/components/sports/SportCard";


export default function SportsPage(){


const sports=[

{
name:"Football",
icon:"⚽",
markets:"245"
},

{
name:"NBA",
icon:"🏀",
markets:"86"
},

{
name:"AFL",
icon:"🏉",
markets:"42"
},

{
name:"Tennis",
icon:"🎾",
markets:"120"
}

];


return (

<main className="min-h-screen bg-slate-100">


<Navbar />


<div className="flex">


<Sidebar />


<section className="flex-1 p-8">


<div>

<h1 className="
text-4xl
font-bold
">

Sports Intelligence

</h1>


<p className="
text-gray-500
mt-3
text-lg
">

Explore markets, leagues and betting opportunities

</p>


</div>


<p className="text-gray-500 mt-2">
Browse markets and betting opportunities
</p>

<h2 className="
text-2xl
font-bold
mt-10
mb-5
">

Featured Sports

</h2>

<div className="grid md:grid-cols-4 gap-6 mt-8">


{sports.map((sport)=>(

<SportCard
key={sport.name}
name={sport.name}
icon={sport.icon}
markets={sport.markets}
/>

))}


</div>




<div className="mt-10">


<h2 className="text-2xl font-bold">
Upcoming Events
</h2>



<div className="bg-white rounded-xl shadow mt-5 p-6">


<div className="border-b p-4">

⚽ Arsenal vs Chelsea

<span className="float-right">
Today
</span>

</div>


<div className="border-b p-4">

🏀 Lakers vs Celtics

<span className="float-right">
Tomorrow
</span>

</div>


<div className="p-4">

🏉 Collingwood vs Richmond

<span className="float-right">
Friday
</span>

</div>


</div>


</div>



</section>


</div>


</main>

);


}