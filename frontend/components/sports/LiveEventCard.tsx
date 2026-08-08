export default function LiveEventCard(){

return (

<div className="
bg-white
rounded-2xl
border
p-6
shadow-sm
">


<div className="
flex
justify-between
">

<h3 className="font-bold text-xl">
⚽ Arsenal vs Chelsea
</h3>


<span className="
bg-red-100
text-red-600
px-3
py-1
rounded-full
text-sm
">

LIVE

</span>

</div>



<p className="text-gray-500 mt-3">
Match Winner
</p>



<div className="
mt-5
flex
justify-between
items-center
">


<div>

<p className="text-sm text-gray-500">
Best Value
</p>

<p className="text-2xl font-bold">
Arsenal 2.50
</p>

</div>


<div className="
bg-green-100
text-green-700
px-4
py-2
rounded-xl
font-bold
">

+13.6%

</div>


</div>


</div>

);

}