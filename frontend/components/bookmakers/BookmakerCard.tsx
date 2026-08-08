type Props = {
  name:string;
  balance:string;
  color:string;
};


export default function BookmakerCard({
  name,
  balance,
  color
}:Props){


return (

<div className="
bg-white
rounded-2xl
border
p-6
hover:shadow-xl
transition
">


<div className="
flex
justify-between
items-center
">


<div>

<h2 className="
text-xl
font-bold
">

{name}

</h2>


<p className="
text-gray-500
mt-2
">

Available Balance

</p>


</div>



<div className="
text-4xl
">

{color}

</div>


</div>



<div className="
mt-6
bg-slate-100
rounded-xl
p-4
">


<p className="
text-gray-500
">

Balance

</p>


<h3 className="
text-3xl
font-bold
mt-1
">

{balance}

</h3>


</div>




<div className="
mt-5
flex
justify-between
">


<span className="
bg-green-100
text-green-700
px-3
py-1
rounded-full
text-sm
">

Active

</span>



<button className="
text-blue-600
font-semibold
">

Manage →

</button>


</div>


</div>

);

}