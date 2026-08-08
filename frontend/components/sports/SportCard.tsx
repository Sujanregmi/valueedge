"use client";

import { useRouter } from "next/navigation";


type Props = {
  name:string;
  icon:string;
  markets:string;
};


export default function SportCard({
  name,
  icon,
  markets
}:Props){


const router = useRouter();



function openSport(){

if(name === "Football"){

router.push("/markets/football");

}

else{

router.push(`/markets/${name.toLowerCase()}`);

}

}



return (

<div
onClick={openSport}
className="
bg-white
rounded-2xl
border
p-6
hover:shadow-xl
hover:-translate-y-1
transition-all
cursor-pointer
"
>


<div className="
flex
justify-between
">


<div className="text-5xl">
{icon}
</div>


<div className="
bg-green-100
text-green-700
text-xs
px-3
py-1
rounded-full
">

Active

</div>


</div>



<h2 className="
text-xl
font-bold
mt-6
">

{name}

</h2>



<p className="
text-gray-500
mt-2
">

{markets} markets available

</p>



<div className="
mt-5
text-blue-600
font-semibold
">

Explore Markets →

</div>



</div>

);

}