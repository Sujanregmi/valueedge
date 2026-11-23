"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Trophy,
  ClipboardList,
  Wallet,
  Landmark,
  Settings,
  X,
  LogOut,
} from "lucide-react";

import { useSidebar } from "@/components/layout/SidebarContext";

type MenuItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    label: "Trading",
    items: [
      { name: "Value Bets", path: "/value-bets", icon: Zap },
      { name: "Sports", path: "/sports", icon: Trophy },
      { name: "My Bets", path: "/portfolio", icon: ClipboardList },
      { name: "Bankroll", path: "/bankroll", icon: Wallet },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "Bookmakers", path: "/bookmakers", icon: Landmark },
      { name: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white
          transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* BRAND */}
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <h1 className="flex items-center gap-1.5 text-2xl font-bold text-green-400">
              <Zap className="fill-green-400" size={22} />
              EdgePulse
            </h1>
            <p className="mt-1 text-xs text-slate-400">Betting Intelligence</p>
          </div>

          <button
            type="button"
            onClick={close}
            className="text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAV */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={close}
                      className={`
                        group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition
                        ${
                          active
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                        }
                      `}
                    >
                      <Icon
                        size={18}
                        className={
                          active
                            ? "text-green-400"
                            : "text-slate-400 group-hover:text-slate-200"
                        }
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* FOOTER / USER CARD */}
       
      </aside>
    </>
  );
}