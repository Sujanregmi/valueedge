type Props = {
  name:string;
  odds:string;
  edge?:string;
};


export default function OddsButton({
  name,
  odds,
  edge
}:Props){


return (

<div
className="
border
rounded-xl
p-4
hover:border-green-500
hover:bg-green-50
transition
cursor-pointer
"
>


<div className="
flex
justify-between
items-center
">


<div>

<p className="font-semibold">
{name}
</p>


{edge && (

<p className="
text-green-600
text-sm
font-bold
mt-1
">

{edge} Edge

</p>

)}

</div>



<div className="
text-xl
font-bold
"
>

{odds}

</div>


</div>


</div>

);

}