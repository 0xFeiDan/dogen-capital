"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Database, LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { DataModal } from "./DataModal";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "仪表盘",
  "/journal": "交易日志",
  "/thoughts": "思考笔记",
};

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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
      <header className="h-14 flex items-center justify-between px-4 lg:px-5 border-b border-border bg-surface-1/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setDataModalOpen(true)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "text-text-muted hover:text-text-primary hover:bg-surface-3",
              !mounted && "pointer-events-none opacity-0"
            )}
            aria-label="导入 / 导出本地数据"
            title="导入 / 导出本地数据"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">本地数据</span>
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors",
              !mounted && "pointer-events-none opacity-0"
            )}
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
            aria-label="退出登录"
            title="退出登录"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      <DataModal open={dataModalOpen} onClose={() => setDataModalOpen(false)} />
    </>
  );
}
