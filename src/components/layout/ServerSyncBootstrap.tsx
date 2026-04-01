"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { syncServerSnapshot } from "@/lib/server-sync-client";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";

const SYNC_INTERVAL_MS = 30000;
const DEBOUNCE_MS = 2000;

export function ServerSyncBootstrap() {
  const pathname = usePathname();
  const tradesHydrated = useTrades((state) => state._hydrated);
  const thoughtsHydrated = useThoughts((state) => state._hydrated);
  const settingsHydrated = usePortfolioSettings((state) => state._hydrated);
  const [ready, setReady] = useState(pathname === "/login");
  const [error, setError] = useState("");
  const hasBootstrappedRef = useRef(false);
  const prevPathnameRef = useRef(pathname);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storesReady = tradesHydrated && thoughtsHydrated && settingsHydrated;

  if (prevPathnameRef.current === "/login" && pathname !== "/login") {
    hasBootstrappedRef.current = false;
  }
  prevPathnameRef.current = pathname;

  const sync = useCallback(async () => {
    try {
      await syncServerSnapshot();
      setReady(true);
      setError("");
      hasBootstrappedRef.current = true;
    } catch (syncError) {
      setReady(true);
      setError((syncError as Error).message);
    }
  }, []);

  const debouncedSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void sync();
    }, DEBOUNCE_MS);
  }, [sync]);

  useEffect(() => {
    if (pathname === "/login") {
      setReady(true);
      setError("");
      return;
    }

    if (!storesReady) {
      setReady(false);
      return;
    }

    if (!hasBootstrappedRef.current) {
      setReady(false);
      void sync();
    } else {
      void sync();
    }

    const interval = window.setInterval(() => {
      void sync();
    }, SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        debouncedSync();
      }
    };

    const handleFocus = () => {
      debouncedSync();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname, storesReady, sync, debouncedSync]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      {!ready && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface/90 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 px-5 py-4 shadow-card">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-text-primary">正在同步服务器数据</p>
              <p className="text-xs text-text-muted">首次进入会先从服务器加载最新记录</p>
            </div>
          </div>
        </div>
      )}

      {ready && error && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-xs rounded-xl border border-warning/20 bg-surface-1 px-4 py-3 text-xs text-text-secondary shadow-card">
          服务器同步失败，当前显示的是本地缓存。错误: {error}
        </div>
      )}
    </>
  );
}
