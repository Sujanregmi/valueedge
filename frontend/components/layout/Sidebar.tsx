"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


export default function Sidebar() {

  const pathname = usePathname();


  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "📊"
    },
    {
      name: "Value Bets",
      path: "/value-bets",
      icon: "⚡"
    },
    {
      name: "Sports",
      path: "/sports",
      icon: "🏀"
    },
    {
      name: "My Bets",
      path: "/my-bets",
      icon: "📋"
    },
    {
      name: "Bankroll",
      path: "/bankroll",
      icon: "💰"
    },
    {
      name: "Bookmakers",
      path: "/bookmakers",
      icon: "🏦"
    },
    {
      name: "Settings",
      path: "/settings",
      icon: "⚙️"
    }
  ];


  return (

    <aside className="w-64 min-h-screen bg-slate-900 text-white p-6">


      <div className="mb-10">

        <h1 className="text-3xl font-bold text-green-400">
          ⚡ EdgePulse
        </h1>

        <p className="text-sm text-slate-400 mt-1">
          Betting Intelligence
        </p>

      </div>



      <nav className="space-y-2">


        {menu.map((item)=>(

          <Link
            key={item.path}
            href={item.path}
            className={`
              flex items-center gap-3 
              px-4 py-3 rounded-lg
              transition
              ${
                pathname === item.path
                ? "bg-green-500 text-white"
                : "hover:bg-slate-800 text-slate-300"
              }
            `}
          >

            <span>
              {item.icon}
            </span>

            {item.name}

          </Link>

        ))}


      </nav>


    </aside>

  );

}