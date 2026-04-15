"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { deleteDcaEntryFromServer } from "@/lib/server-sync-client";
import { cn, formatCurrency, formatDate, formatPrice } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { useDcaEntries } from "@/store/useDcaEntries";
import type { Currency, DcaAssetClass, DcaEntry } from "@/types";
import { DcaDrawer } from "./DcaDrawer";
import { dcaToForm, type DcaFormState } from "./DcaForm";

type AssetFilter = "all" | DcaAssetClass;

interface DcaPosition {
  key: string;
  ticker: string;
  name?: string;
  assetClass: DcaAssetClass;
  currency: Currency;
  totalInvestedAmount: number;
  totalQuantity: number;
  averageCost: number;
  currentPrice?: number;
  marketValue: number;
  unrealizedPnl: number;
  entriesCount: number;
  lastInvestedAt: string;
}

const PAGE_BLURB =
  "\u4e0d\u63a5 API\uff0c\u53ea\u8bb0\u5f55\u4f60\u6bcf\u4e00\u6b21\u624b\u52a8\u5b9a\u6295\u7684\u91d1\u989d\u548c\u6570\u91cf\u3002";
const ADD_ENTRY_TEXT = "\u65b0\u589e\u5b9a\u6295";
const SEARCH_PLACEHOLDER = "\u641c\u7d22\u4ee3\u7801\u3001\u540d\u79f0\u6216\u5907\u6ce8";
const FILTER_ALL = "\u5168\u90e8";
const FILTER_STOCK = "\u80a1\u7968";
const FILTER_CRYPTO = "\u865a\u62df\u8d27\u5e01";
const POSITIONS_TITLE = "\u6301\u4ed3\u6210\u672c\u6c47\u603b";
const RECORDS_TITLE = "\u5b9a\u6295\u8bb0\u5f55";
const DELETE_DIALOG_TITLE = "\u5220\u9664\u5b9a\u6295\u8bb0\u5f55\uff1f";
const DELETE_LABEL = "\u5220\u9664";
const DELETE_ERROR = "\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const EMPTY_TITLE = "\u8fd8\u6ca1\u6709\u5b9a\u6295\u8bb0\u5f55";
const EMPTY_TEXT =
  "\u4f60\u53ef\u4ee5\u5148\u6dfb\u52a0\u80a1\u7968\u6216\u865a\u62df\u8d27\u5e01\u7684\u624b\u52a8\u5b9a\u6295\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u5e2e\u4f60\u6c47\u603b\u6210\u672c\u548c\u7d2f\u8ba1\u6570\u91cf\u3002";
const METRIC_POSITIONS = "\u6301\u4ed3\u6807\u7684";
const METRIC_RECORDS = "\u5b9a\u6295\u6b21\u6570";
const METRIC_STOCKS = "\u80a1\u7968\u6807\u7684";
const METRIC_CRYPTOS = "\u5e01\u79cd\u6807\u7684";
const METRIC_INVESTED = "\u7d2f\u8ba1\u6295\u5165";
const METRIC_MARKET_VALUE = "\u5f53\u524d\u5e02\u503c";
const METRIC_FLOATING_PNL = "\u6d6e\u52a8\u76c8\u4e8f";
const MULTI_CURRENCY_LABEL = "\u591a\u5e01\u79cd";
const POSITIONS_SUB =
  "\u6309\u4ee3\u7801 + \u5e01\u79cd\u6c47\u603b\uff0c\u65b9\u4fbf\u67e5\u770b\u7d2f\u8ba1\u6210\u672c\u3001\u5b9e\u65f6\u5e02\u503c\u548c\u6d6e\u52a8\u76c8\u4e8f\u3002";
const RECORDS_SUB =
  "\u4fdd\u7559\u6bcf\u4e00\u7b14\u539f\u59cb\u8f93\u5165\uff0c\u540e\u9762\u4f60\u60f3\u56de\u770b\u8282\u594f\u3001\u52a0\u4ed3\u65f6\u70b9\u4e5f\u4f1a\u6bd4\u8f83\u65b9\u4fbf\u3002";
const FILTER_EMPTY_TEXT =
  "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5b9a\u6295\u8bb0\u5f55\u3002";
const RECORD_FILTER_EMPTY_TEXT =
  "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684\u5b9a\u6295\u8bb0\u5f55\u3002";
const NO_PRICE_TEXT = "\u7b49\u5f85\u884c\u60c5";
const POSITION_COL_TICKER = "\u6807\u7684";
const POSITION_COL_CLASS = "\u677f\u5757";
const POSITION_COL_INVESTED = "\u7d2f\u8ba1\u6295\u5165";
const POSITION_COL_QUANTITY = "\u7d2f\u8ba1\u6570\u91cf";
const POSITION_COL_COST = "\u6301\u4ed3\u5747\u4ef7";
const POSITION_COL_PRICE = "\u5f53\u524d\u4ef7";
const POSITION_COL_VALUE = "\u5f53\u524d\u5e02\u503c";
const POSITION_COL_PNL = "\u6d6e\u52a8\u76c8\u4e8f";
const POSITION_COL_COUNT = "\u6b21\u6570";
const POSITION_COL_LAST = "\u6700\u8fd1\u4e00\u6b21";
const RECORD_COL_DATE = "\u65e5\u671f";
const RECORD_COL_ASSET = "\u6807\u7684";
const RECORD_COL_AMOUNT = "\u6295\u5165\u91d1\u989d";
const RECORD_COL_BOUGHT = "\u4e70\u5165\u6570\u91cf";
const RECORD_COL_PRICE = "\u672c\u6b21\u5747\u4ef7";
const RECORD_COL_LIVE_PRICE = "\u5f53\u524d\u4ef7";
const RECORD_COL_NOTE = "\u5907\u6ce8";
const RECORD_COL_ACTION = "\u64cd\u4f5c";
const ACTION_EDIT = "\u7f16\u8f91";
const ACTION_REPEAT = "\u518d\u6295";
const ACTION_DELETE = "\u5220\u9664";

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function getAssetClassLabel(assetClass: DcaAssetClass): string {
  return assetClass === "stock" ? FILTER_STOCK : FILTER_CRYPTO;
}

function buildCurrencyBreakdown(entries: DcaEntry[]) {
  const totals = new Map<Currency, number>();

  entries.forEach((entry) => {
    totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + entry.investedAmount);
  });

  return Array.from(totals.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

function buildPositionCurrencyBreakdown(
  positions: DcaPosition[],
  selector: (position: DcaPosition) => number
) {
  const totals = new Map<Currency, number>();

  positions.forEach((position) => {
    totals.set(position.currency, (totals.get(position.currency) ?? 0) + selector(position));
  });

  return Array.from(totals.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function getBreakdownText(
  breakdown: Array<{ currency: Currency; total: number }>,
  emptyHint = "\u6682\u65e0\u6570\u636e"
) {
  if (breakdown.length === 0) {
    return { display: "--", hint: emptyHint };
  }

  if (breakdown.length === 1) {
    return {
      display: formatCurrency(breakdown[0].total, breakdown[0].currency),
      hint: `${breakdown[0].currency} ${formatCurrency(breakdown[0].total, breakdown[0].currency)}`,
    };
  }

  return {
    display: MULTI_CURRENCY_LABEL,
    hint: breakdown
      .slice(0, 3)
      .map(({ currency, total }) => `${currency} ${formatCurrency(total, currency)}`)
      .join(" / "),
  };
}

function buildPositions(entries: DcaEntry[]): DcaPosition[] {
  const grouped = new Map<string, DcaPosition>();

  entries.forEach((entry) => {
    const key = `${entry.assetClass}:${entry.currency}:${entry.ticker}`;
    const current = grouped.get(key);

    if (current) {
      current.totalInvestedAmount += entry.investedAmount;
      current.totalQuantity += entry.quantity;
      if (entry.currentPrice != null && entry.currentPrice > 0) {
        current.marketValue += entry.currentPrice * entry.quantity;
        current.unrealizedPnl += entry.currentPrice * entry.quantity - entry.investedAmount;
        current.currentPrice = current.marketValue / current.totalQuantity;
      } else {
        current.marketValue += entry.investedAmount;
      }
      current.entriesCount += 1;
      if (entry.investedAt > current.lastInvestedAt) {
        current.lastInvestedAt = entry.investedAt;
      }
      if (!current.name && entry.name) {
        current.name = entry.name;
      }
      current.averageCost = current.totalInvestedAmount / current.totalQuantity;
      return;
    }

    grouped.set(key, {
      key,
      ticker: entry.ticker,
      name: entry.name,
      assetClass: entry.assetClass,
      currency: entry.currency,
      totalInvestedAmount: entry.investedAmount,
      totalQuantity: entry.quantity,
      averageCost: entry.investedAmount / entry.quantity,
      currentPrice:
        entry.currentPrice != null && entry.currentPrice > 0 ? entry.currentPrice : undefined,
      marketValue:
        entry.currentPrice != null && entry.currentPrice > 0
          ? entry.currentPrice * entry.quantity
          : entry.investedAmount,
      unrealizedPnl:
        entry.currentPrice != null && entry.currentPrice > 0
          ? entry.currentPrice * entry.quantity - entry.investedAmount
          : 0,
      entriesCount: 1,
      lastInvestedAt: entry.investedAt,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.lastInvestedAt !== a.lastInvestedAt) {
      return b.lastInvestedAt.localeCompare(a.lastInvestedAt);
    }

    return a.ticker.localeCompare(b.ticker);
  });
}

function matchesFilter(entry: DcaEntry, filter: AssetFilter, query: string) {
  if (filter !== "all" && entry.assetClass !== filter) {
    return false;
  }

  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return (
    entry.ticker.toLowerCase().includes(lowerQuery) ||
    (entry.name ?? "").toLowerCase().includes(lowerQuery) ||
    (entry.notes ?? "").toLowerCase().includes(lowerQuery)
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="min-w-0">
      <p className="text-2xs font-medium uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-3 truncate text-2xl font-semibold text-text-primary tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}

export function DcaView() {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const entries = useDcaEntries((state) => state.entries);
  const removeEntry = useDcaEntries((state) => state.deleteEntry);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DcaEntry | null>(null);
  const [draftValues, setDraftValues] = useState<DcaFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DcaEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filteredEntries = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return [...entries]
      .filter((entry) => matchesFilter(entry, assetFilter, normalizedQuery))
      .sort((a, b) => {
        if (b.investedAt !== a.investedAt) {
          return b.investedAt.localeCompare(a.investedAt);
        }

        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [assetFilter, entries, search]);

  const positions = useMemo(() => buildPositions(filteredEntries), [filteredEntries]);
  const allPositions = useMemo(() => buildPositions(entries), [entries]);
  const currencyBreakdown = useMemo(
    () => buildCurrencyBreakdown(filteredEntries),
    [filteredEntries]
  );
  const marketValueBreakdown = useMemo(
    () => buildPositionCurrencyBreakdown(positions, (position) => position.marketValue),
    [positions]
  );
  const floatingPnlBreakdown = useMemo(
    () => buildPositionCurrencyBreakdown(positions, (position) => position.unrealizedPnl),
    [positions]
  );
  const stockPositions = allPositions.filter((position) => position.assetClass === "stock").length;
  const cryptoPositions = allPositions.filter(
    (position) => position.assetClass === "crypto"
  ).length;

  const investedDisplay = useMemo(() => {
    if (currencyBreakdown.length === 0) {
      return "--";
    }

    if (currencyBreakdown.length === 1) {
      return formatCurrency(currencyBreakdown[0].total, currencyBreakdown[0].currency);
    }

    return MULTI_CURRENCY_LABEL;
  }, [currencyBreakdown]);

  const investedHint = useMemo(() => {
    if (currencyBreakdown.length === 0) {
      return "\u6682\u65e0\u6570\u636e";
    }

    return currencyBreakdown
      .slice(0, 3)
      .map(({ currency, total }) => `${currency} ${formatCurrency(total, currency)}`)
      .join(" / ");
  }, [currencyBreakdown]);
  const marketValueText = useMemo(
    () => getBreakdownText(marketValueBreakdown),
    [marketValueBreakdown]
  );
  const floatingPnlText = useMemo(
    () => getBreakdownText(floatingPnlBreakdown),
    [floatingPnlBreakdown]
  );

  function handleNew() {
    setEditingEntry(null);
    setDraftValues(null);
    setDrawerOpen(true);
  }

  function handleEdit(entry: DcaEntry) {
    setEditingEntry(entry);
    setDraftValues(null);
    setDrawerOpen(true);
  }

  function handleRepeat(entry: DcaEntry) {
    const nextValues = dcaToForm(entry);
    setEditingEntry(null);
    setDraftValues({
      ...nextValues,
      investedAt: todayInputDate(),
    });
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setEditingEntry(null);
    setDraftValues(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await deleteDcaEntryFromServer(activeUserId, deleteTarget.id);
      removeEntry(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError((err as Error).message || DELETE_ERROR);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm text-text-muted">{PAGE_BLURB}</p>
          </div>

          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={handleNew}
            className="shrink-0 self-start lg:self-auto"
          >
            {ADD_ENTRY_TEXT}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricCard label={METRIC_POSITIONS} value={String(allPositions.length)} />
          <MetricCard label={METRIC_RECORDS} value={String(entries.length)} />
          <MetricCard label={METRIC_STOCKS} value={String(stockPositions)} />
          <MetricCard label={METRIC_CRYPTOS} value={String(cryptoPositions)} />
          <MetricCard label={METRIC_INVESTED} value={investedDisplay} hint={investedHint} />
          <MetricCard
            label={METRIC_MARKET_VALUE}
            value={marketValueText.display}
            hint={marketValueText.hint}
          />
          <MetricCard
            label={METRIC_FLOATING_PNL}
            value={floatingPnlText.display}
            hint={floatingPnlText.hint}
          />
        </div>

        <Card className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={SEARCH_PLACEHOLDER}
                className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm text-text-primary outline-none transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: FILTER_ALL },
                { value: "stock", label: FILTER_STOCK },
                { value: "crypto", label: FILTER_CRYPTO },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={assetFilter === option.value ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setAssetFilter(option.value as AssetFilter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {entries.length === 0 ? (
          <Card className="flex flex-col items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{EMPTY_TITLE}</h2>
              <p className="mt-2 text-sm text-text-muted">{EMPTY_TEXT}</p>
            </div>
            <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />} onClick={handleNew}>
              {ADD_ENTRY_TEXT}
            </Button>
          </Card>
        ) : (
          <>
            <Card noPadding className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-text-primary">{POSITIONS_TITLE}</h2>
                <p className="mt-1 text-xs text-text-muted">{POSITIONS_SUB}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-2/70 text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">{POSITION_COL_TICKER}</th>
                      <th className="px-4 py-3 text-left font-medium">{POSITION_COL_CLASS}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_INVESTED}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_QUANTITY}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_COST}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_PRICE}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_VALUE}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_PNL}</th>
                      <th className="px-4 py-3 text-right font-medium">{POSITION_COL_COUNT}</th>
                      <th className="px-5 py-3 text-right font-medium">{POSITION_COL_LAST}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-8 text-center text-sm text-text-muted">
                          {FILTER_EMPTY_TEXT}
                        </td>
                      </tr>
                    ) : (
                      positions.map((position) => (
                        <tr key={position.key} className="border-t border-border/70">
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-medium text-text-primary">{position.ticker}</p>
                              {position.name && (
                                <p className="mt-1 text-xs text-text-muted">{position.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                                position.assetClass === "stock"
                                  ? "border-accent/20 bg-accent/10 text-accent"
                                  : "border-profit/20 bg-profit/10 text-profit"
                              )}
                            >
                              {getAssetClassLabel(position.assetClass)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-text-primary tabular-nums">
                            {formatCurrency(position.totalInvestedAmount, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                            {formatQuantity(position.totalQuantity)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                            {formatPrice(position.averageCost, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                            {position.currentPrice != null
                              ? formatPrice(position.currentPrice, position.currency)
                              : NO_PRICE_TEXT}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-text-primary tabular-nums">
                            {formatCurrency(position.marketValue, position.currency)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-4 text-right font-medium tabular-nums",
                              position.unrealizedPnl > 0 && "text-profit",
                              position.unrealizedPnl < 0 && "text-loss",
                              position.unrealizedPnl === 0 && "text-text-secondary"
                            )}
                          >
                            {position.unrealizedPnl > 0 ? "+" : ""}
                            {formatCurrency(position.unrealizedPnl, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                            {position.entriesCount}
                          </td>
                          <td className="px-5 py-4 text-right text-text-secondary tabular-nums">
                            {formatDate(position.lastInvestedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-text-primary">{RECORDS_TITLE}</h2>
                <p className="mt-1 text-xs text-text-muted">{RECORDS_SUB}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-2/70 text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">{RECORD_COL_DATE}</th>
                      <th className="px-4 py-3 text-left font-medium">{RECORD_COL_ASSET}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_AMOUNT}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_BOUGHT}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_PRICE}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_LIVE_PRICE}</th>
                      <th className="px-4 py-3 text-left font-medium">{RECORD_COL_NOTE}</th>
                      <th className="px-5 py-3 text-right font-medium">{RECORD_COL_ACTION}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-sm text-text-muted">
                          {RECORD_FILTER_EMPTY_TEXT}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry) => {
                        const averageCost = entry.investedAmount / entry.quantity;

                        return (
                          <tr key={entry.id} className="border-t border-border/70">
                            <td className="px-5 py-4 text-text-secondary tabular-nums">
                              {formatDate(entry.investedAt)}
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-text-primary">{entry.ticker}</span>
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full border px-2 py-0.5 text-2xs font-medium",
                                      entry.assetClass === "stock"
                                        ? "border-accent/20 bg-accent/10 text-accent"
                                        : "border-profit/20 bg-profit/10 text-profit"
                                    )}
                                  >
                                    {getAssetClassLabel(entry.assetClass)}
                                  </span>
                                </div>
                                {entry.name && (
                                  <p className="mt-1 text-xs text-text-muted">{entry.name}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-text-primary tabular-nums">
                              {formatCurrency(entry.investedAmount, entry.currency)}
                            </td>
                            <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                              {formatQuantity(entry.quantity)}
                            </td>
                            <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                              {formatPrice(averageCost, entry.currency)}
                            </td>
                            <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                              {entry.currentPrice != null && entry.currentPrice > 0
                                ? formatPrice(entry.currentPrice, entry.quoteCurrency ?? entry.currency)
                                : NO_PRICE_TEXT}
                            </td>
                            <td className="max-w-[220px] px-4 py-4 text-sm text-text-muted">
                              <p className="line-clamp-2">{entry.notes ?? "--"}</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  iconLeft={<Pencil className="h-3.5 w-3.5" />}
                                  onClick={() => handleEdit(entry)}
                                >
                                  {ACTION_EDIT}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  iconLeft={<Plus className="h-3.5 w-3.5" />}
                                  onClick={() => handleRepeat(entry)}
                                >
                                  {ACTION_REPEAT}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                                  onClick={() => setDeleteTarget(entry)}
                                >
                                  {ACTION_DELETE}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <DcaDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        editingEntry={editingEntry}
        initialValues={draftValues}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title={DELETE_DIALOG_TITLE}
        description={
          deleteTarget
            ? deleteError
              ? `\u5220\u9664\u5931\u8d25: ${deleteError}`
              : `\u8fd9\u4f1a\u6c38\u4e45\u5220\u9664 ${deleteTarget.ticker} \u7684\u5b9a\u6295\u8bb0\u5f55\uff0c\u4e14\u65e0\u6cd5\u64a4\u9500\u3002`
            : undefined
        }
        confirmLabel={DELETE_LABEL}
        confirmVariant="danger"
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        loading={deleting}
      />
    </>
  );
}
