"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bitcoin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { cn, formatCurrency, formatPrice } from "@/lib/utils";

interface TreasuryMnavHolding {
  asset: "BTC";
  units: number;
  priceUsd: number | null;
  valueUsd: number;
}

interface TreasuryMnavItem {
  ticker: "MSTR";
  name: string;
  stockPrice: number | null;
  currency: string;
  marketCapUsd: number | null;
  tokenMarketValueUsd: number;
  mnav: number | null;
  holdings: TreasuryMnavHolding[];
  sourceAsOf: string | null;
  sourceUrl?: string;
  dataAsOf?: {
    prices?: string | null;
    holdings?: string | null;
  };
}

interface TreasuryMnavResponse {
  items?: TreasuryMnavItem[];
  fetchedAt?: string;
  error?: string;
}

const SECTION_TITLE = "mNAV \u76d1\u63a7";
const SECTION_SUB = "MSTR \u8d22\u5e93\u4f30\u503c\u500d\u6570";
const REFRESH_LABEL = "\u5237\u65b0";
const LOADING_LABEL = "\u52a0\u8f7d\u4e2d";
const UNAVAILABLE_LABEL = "\u6682\u4e0d\u53ef\u7528";
const STOCK_PRICE_LABEL = "\u80a1\u4ef7";
const MARKET_CAP_LABEL = "\u5e02\u503c";
const TOKEN_HOLDINGS_LABEL = "\u6bd4\u7279\u5e01\u6301\u4ed3";
const TOKEN_PRICE_LABEL = "\u6bd4\u7279\u5e01\u4ef7\u683c";
const TOKEN_MARKET_VALUE_LABEL = "\u6bd4\u7279\u5e01\u5e02\u503c";
const UPDATED_LABEL = "\u66f4\u65b0";
const DATA_AS_OF_LABEL = "\u53e3\u5f84";
const REFRESH_INTERVAL_MS = 60000;
const MAX_REFRESH_INTERVAL_MS = 5 * 60000;

function formatCompactCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMnav(value: number | null): string {
  return value != null ? `${value.toFixed(3)}x` : "--";
}

function formatUpdatedAt(value?: string): string {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function TreasuryMnavCard({ item }: { item: TreasuryMnavItem }) {
  const dataAsOfParts = [
    item.dataAsOf?.prices ? `\u4ef7\u683c ${formatDate(item.dataAsOf.prices)}` : null,
    item.dataAsOf?.holdings ? `\u6301\u4ed3 ${formatDate(item.dataAsOf.holdings)}` : null,
  ].filter(Boolean);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface-1 p-5 shadow-card shadow-inner-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {item.ticker} mNAV
          </p>
          <p className="mt-1 truncate text-sm text-text-secondary">{item.name}</p>
        </div>
        <div className="rounded-lg bg-surface-3 p-1.5 text-accent">
          <Bitcoin className="h-3.5 w-3.5" />
        </div>
      </div>

      <p className="mb-4 text-3xl font-semibold leading-none tracking-tight text-text-primary tabular-nums">
        {formatMnav(item.mnav)}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">{STOCK_PRICE_LABEL}</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">
            {item.stockPrice != null ? formatCurrency(item.stockPrice, "USD", true) : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">{MARKET_CAP_LABEL}</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">
            {formatCompactCurrency(item.marketCapUsd)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">{TOKEN_HOLDINGS_LABEL}</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">
            {item.holdings.length > 0 ? `${formatNumber(item.holdings[0].units)} BTC` : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">{TOKEN_PRICE_LABEL}</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">
            {item.holdings[0]?.priceUsd != null ? formatPrice(item.holdings[0].priceUsd, "USD") : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">{TOKEN_MARKET_VALUE_LABEL}</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">
            {formatCompactCurrency(item.tokenMarketValueUsd)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-text-muted">mNAV</p>
          <p className="mt-1 font-medium text-text-primary tabular-nums">{formatMnav(item.mnav)}</p>
        </div>
      </div>
      {dataAsOfParts.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          {DATA_AS_OF_LABEL}: {dataAsOfParts.join(" / ")}
        </p>
      )}
    </div>
  );
}

function TreasuryMnavSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5 shadow-card shadow-inner-sm">
      <div className="mb-5 h-4 w-28 animate-pulse rounded bg-surface-3" />
      <div className="h-8 w-24 animate-pulse rounded bg-surface-3" />
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="h-12 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-12 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-12 animate-pulse rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}

export function TreasuryMnavCards() {
  const [items, setItems] = useState<TreasuryMnavItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);
  const errorStreakRef = useRef(0);
  const nextDelayRef = useRef(REFRESH_INTERVAL_MS);

  const hasItems = items.length > 0;
  const statusText = useMemo(() => {
    if (error) return error;
    if (loading && !hasItems) return LOADING_LABEL;
    return `${UPDATED_LABEL} ${formatUpdatedAt(fetchedAt)}`;
  }, [error, fetchedAt, hasItems, loading]);

  const refresh = useCallback(async (silent = false) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    if (!silent) setRefreshing(true);

    try {
      const response = await fetch("/api/market/treasury-mnav", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as TreasuryMnavResponse;

      if (!response.ok) throw new Error(data.error || UNAVAILABLE_LABEL);
      if (requestSeq !== requestSeqRef.current) return;

      setItems(data.items ?? []);
      setFetchedAt(data.fetchedAt);
      setError("");
      errorStreakRef.current = 0;
      nextDelayRef.current = REFRESH_INTERVAL_MS;
    } catch (requestError) {
      if (requestSeq !== requestSeqRef.current) return;

      setError(requestError instanceof Error ? requestError.message : UNAVAILABLE_LABEL);
      errorStreakRef.current += 1;
      nextDelayRef.current = Math.min(
        REFRESH_INTERVAL_MS * 2 ** errorStreakRef.current,
        MAX_REFRESH_INTERVAL_MS
      );
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;

    const schedule = () => {
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") await refresh(true);
        schedule();
      }, nextDelayRef.current);
    };

    void refresh(true);
    schedule();

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [refresh]);

  return (
    <Card noPadding>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <CardTitle>{SECTION_TITLE}</CardTitle>
          <p className="mt-1 text-xs text-text-muted">{SECTION_SUB}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("flex items-center gap-1 text-xs text-text-muted", error && "text-loss")}>
            {error && <AlertTriangle className="h-3.5 w-3.5" />}
            {statusText}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void refresh(false)}
            disabled={refreshing}
            iconLeft={<RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />}
          >
            {REFRESH_LABEL}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5">
        {loading && !hasItems ? (
          <TreasuryMnavSkeleton />
        ) : hasItems ? (
          items.map((item) => <TreasuryMnavCard key={item.ticker} item={item} />)
        ) : (
          <div className="rounded-xl border border-border bg-surface-1 p-5 text-sm text-text-muted">
            {UNAVAILABLE_LABEL}
          </div>
        )}
      </div>
    </Card>
  );
}
