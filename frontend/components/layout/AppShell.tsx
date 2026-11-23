"use client";

import type { ReactNode } from "react";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Navbar />

          <main className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}