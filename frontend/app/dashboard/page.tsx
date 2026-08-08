import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import StatsCard from "./components/StatsCard";


export default function DashboardPage() {

  return (
    <main className="min-h-screen bg-slate-100">

      <Navbar />

      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-8">

          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="text-gray-500 mt-2">
            Welcome to EdgePulse
          </p>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">

            <StatsCard
              title="Bankroll"
              value="$0"
            />

            <StatsCard
              title="Today's Profit"
              value="$0"
            />

            <StatsCard
              title="Active Bets"
              value="0"
            />

          </div>


        </section>

      </div>

    </main>
  );
}