"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Database, LogOut, Menu, Moon, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { APP_USERS, useAppUsers } from "@/store/useAppUsers";
import { DataModal } from "./DataModal";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "\u4eea\u8868\u76d8",
  "/journal": "\u4ea4\u6613\u65e5\u5fd7",
  "/dca": "\u5b9a\u6295",
  "/thoughts": "\u601d\u8003\u7b14\u8bb0",
};
const DATA_MANAGEMENT_LABEL = "\u6570\u636e\u7ba1\u7406";
const LOGOUT_LABEL = "\u9000\u51fa";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const setActiveUser = useAppUsers((state) => state.setActiveUser);
  const [mounted, setMounted] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Dogen Capital";

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface-1/85 px-4 backdrop-blur-md lg:px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary lg:hidden"
            aria-label="\u6253\u5f00\u83dc\u5355"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/80 px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={activeUserId}
              onChange={(event) =>
                setActiveUser(event.target.value as (typeof APP_USERS)[number]["id"])
              }
              className="bg-transparent text-xs font-medium text-text-primary outline-none"
              aria-label="\u5207\u6362\u7528\u6237"
              title="\u5207\u6362\u7528\u6237"
            >
              {APP_USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setDataModalOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary",
              !mounted && "pointer-events-none opacity-0"
            )}
            aria-label="\u5bfc\u5165\u6216\u5bfc\u51fa\u6570\u636e"
            title="\u5bfc\u5165\u6216\u5bfc\u51fa\u6570\u636e"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{DATA_MANAGEMENT_LABEL}</span>
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary",
              !mounted && "pointer-events-none opacity-0"
            )}
            aria-label="\u5207\u6362\u4e3b\u9898"
            title="\u5207\u6362\u4e3b\u9898"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            aria-label="\u9000\u51fa\u767b\u5f55"
            title="\u9000\u51fa\u767b\u5f55"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{LOGOUT_LABEL}</span>
          </button>
        </div>
      </header>

      <DataModal open={dataModalOpen} onClose={() => setDataModalOpen(false)} />
    </>
  );
}
