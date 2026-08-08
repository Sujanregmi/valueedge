export default function BetHistory(){


const bets=[

{
match:"Arsenal vs Chelsea",
result:"Win",
profit:"+$75"
},

{
match:"Lakers vs Celtics",
result:"Loss",
profit:"-$30"
}

];


return (

<div className="
bg-white
rounded-2xl
border
p-6
">


<h2 className="
text-xl
font-bold
mb-5
">
Bet History
</h2>


{bets.map((bet,index)=>(

<div
key={index}
className="
flex
justify-between
border-b
py-4
"
>


<span>
{bet.match}
</span>


<span>
{bet.result}
</span>


<span className="
text-green-600
font-bold
">

{bet.profit}

</span>


</div>

))}


</div>

);

}