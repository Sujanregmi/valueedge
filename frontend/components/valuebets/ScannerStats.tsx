const stats = [
  {
    title: "Opportunities",
    value: "24"
  },
  {
    title: "Average Edge",
    value: "8.5%"
  },
  {
    title: "Best Edge",
    value: "18.2%"
  }
];


export default function ScannerStats(){

  return (

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">


      {stats.map((stat)=>(

        <div
          key={stat.title}
          className="bg-white p-6 rounded-xl shadow"
        >

          <p className="text-gray-500">
            {stat.title}
          </p>


          <h2 className="text-3xl font-bold mt-3">
            {stat.value}
          </h2>


        </div>

      ))}


    </div>

  );

}