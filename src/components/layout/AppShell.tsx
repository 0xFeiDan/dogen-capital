"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BinancePriceBootstrap } from "./BinancePriceBootstrap";
import { Sidebar } from "./Sidebar";
import { ServerSyncBootstrap } from "./ServerSyncBootstrap";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex h-screen bg-surface overflow-hidden">
      <ServerSyncBootstrap />
      <BinancePriceBootstrap />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,136,74,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(232,213,163,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%)]" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-[1920px] mx-auto px-3 md:px-5 xl:px-6 2xl:px-8 py-6 md:py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
