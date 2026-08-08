export default function BetsTable(){

const bets=[

{
event:"Arsenal vs Chelsea",
stake:"$50",
result:"Win",
profit:"+$75"
},

{
event:"Lakers vs Celtics",
stake:"$30",
result:"Loss",
profit:"-$30"
}

];


return (

<div className="bg-white rounded-xl shadow p-6">


<h2 className="text-xl font-bold mb-5">
Recent Bets
</h2>


<table className="w-full">


<thead>

<tr className="border-b">

<th className="text-left p-3">
Event
</th>

<th>
Stake
</th>

<th>
Result
</th>

<th>
P/L
</th>

</tr>

</thead>



<tbody>

{bets.map((bet,index)=>(

<tr key={index} className="border-b">


<td className="p-3">
{bet.event}
</td>


<td>
{bet.stake}
</td>


<td>
{bet.result}
</td>


<td className="text-green-600 font-bold">
{bet.profit}
</td>


</tr>

))}


</tbody>


</table>


</div>

);


}