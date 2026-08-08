import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

import BookmakerCard from "@/components/bookmakers/BookmakerCard";


export default function BookmakersPage(){


const bookmakers=[

{
name:"Bet365",
balance:"$500",
color:"🟢"
},

{
name:"TAB",
balance:"$300",
color:"🔵"
},

{
name:"Sportsbet",
balance:"$250",
color:"🟣"
}

];


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

Bookmakers

</h1>


<p className="
text-gray-500
mt-3
text-lg
">

Manage your betting accounts and balances

</p>




<div className="
grid
md:grid-cols-3
gap-6
mt-8
">


{bookmakers.map((bookmaker)=>(

<BookmakerCard

key={bookmaker.name}

name={bookmaker.name}

balance={bookmaker.balance}

color={bookmaker.color}

/>

))}


</div>



<button className="
mt-8
bg-slate-900
text-white
px-6
py-3
rounded-xl
font-semibold
">

+ Add Bookmaker

</button>



</section>


</div>


</main>

);

}