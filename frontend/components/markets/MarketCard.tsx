import OddsButton from "./OddsButton";


type Props = {
 event:string;
 time:string;
};


export default function MarketCard({
 event,
 time
}:Props){


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


<div>

<h2 className="
text-xl
font-bold
">

{event}

</h2>


<p className="
text-gray-500
mt-1
">

{time}

</p>

</div>



<div className="
bg-green-100
text-green-700
px-3
py-1
rounded-full
text-sm
font-bold
">

+13.6%

</div>


</div>





<h3 className="
font-semibold
mt-6
">

Match Winner

</h3>



<div className="
grid
md:grid-cols-3
gap-4
mt-4
">


<OddsButton
name="Arsenal"
odds="2.50"
edge="+13%"
/>



<OddsButton
name="Draw"
odds="3.20"
/>



<OddsButton
name="Chelsea"
odds="2.80"
/>



</div>


</div>

);

}