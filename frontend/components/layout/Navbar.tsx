"use client";


export default function Navbar(){

  return (

    <header className="h-16 bg-white shadow flex items-center justify-between px-8">


      <div>

        <h2 className="text-xl font-semibold">
          EdgePulse Analytics
        </h2>

      </div>



      <div className="flex items-center gap-6">


        <button className="text-xl">
          🔔
        </button>


        <div className="flex items-center gap-3">


          <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
            U
          </div>


          <div>

            <p className="font-medium">
              User
            </p>

            <p className="text-xs text-gray-500">
              Premium
            </p>

          </div>


        </div>


      </div>


    </header>

  );

}