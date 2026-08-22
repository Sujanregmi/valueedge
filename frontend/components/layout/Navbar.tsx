"use client";

import { Menu, Search, Bell, ChevronDown, Zap } from "lucide-react";

import { useSidebar } from "@/components/layout/SidebarContext";

export default function Navbar() {
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      {/* LEFT: mobile menu + brand (mobile only) + title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="text-gray-500 hover:text-gray-900 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <span className="flex items-center gap-1 font-bold text-green-600 lg:hidden">
          <Zap size={18} className="fill-green-600" />
        </span>

        <h2 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">
          EdgePulse Analytics
        </h2>
      </div>

      {/* CENTER: search (desktop only) */}
      <div className="hidden flex-1 max-w-md md:flex">
        <div className="relative w-full">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search events, teams, bookmakers…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-700 outline-none transition focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100"
          />
        </div>
      </div>

      {/* RIGHT: status, notifications, user */}
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <span className="hidden items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-mono font-semibold text-green-700 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Scanner Online
        </span>

        <button
          type="button"
          className="relative text-gray-500 hover:text-gray-900"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-gray-50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 font-bold text-white">
            U
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-tight text-gray-900">
              User
            </p>
            <p className="text-xs leading-tight text-gray-500">Premium</p>
          </div>
          <ChevronDown size={16} className="hidden text-gray-400 sm:block" />
        </button>
      </div>
    </header>
  );
}