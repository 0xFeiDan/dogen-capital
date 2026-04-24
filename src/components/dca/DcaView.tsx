"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { buildDcaPositionSummaries, type DcaComputedEntry, type DcaPositionSummary } from "@/lib/dca";
import { deleteDcaEntryFromServer } from "@/lib/server-sync-client";
import { cn, formatCurrency, formatDate, formatPrice } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { useDcaEntries } from "@/store/useDcaEntries";
import type { Currency, DcaAssetClass, DcaEntry } from "@/types";
import { DcaDrawer } from "./DcaDrawer";
import { dcaToForm, type DcaFormState } from "./DcaForm";

type AssetFilter = "all" | DcaAssetClass;

const PAGE_BLURB =
  "\u5b9a\u6295\u9875\u73b0\u5728\u540c\u65f6\u8bb0\u5f55\u4e70\u5165\u548c\u5356\u51fa\u6d41\u6c34\uff0c\u5356\u51fa\u91d1\u989d\u4f1a\u4f18\u5148\u51b2\u51cf\u672c\u91d1\uff0c\u8d85\u51fa\u5269\u4f59\u672c\u91d1\u7684\u90e8\u5206\u624d\u8ba1\u5165\u5df2\u5b9e\u73b0\u76c8\u4e8f\u3002";
const ADD_ENTRY_TEXT = "\u65b0\u589e\u4e70\u5165";
const ADD_SELL_TEXT = "\u8bb0\u5f55\u5356\u51fa";
const SEARCH_PLACEHOLDER = "\u641c\u7d22\u4ee3\u7801\u3001\u540d\u79f0\u3001\u5907\u6ce8";
const FILTER_ALL = "\u5168\u90e8";
const FILTER_STOCK = "\u80a1\u7968";
const FILTER_CRYPTO = "\u865a\u62df\u8d27\u5e01";
const POSITIONS_TITLE = "\u5269\u4f59\u6301\u4ed3";
const RECORDS_TITLE = "\u5b9a\u6295\u6d41\u6c34";
const DELETE_DIALOG_TITLE = "\u5220\u9664\u8bb0\u5f55\uff1f";
const DELETE_LABEL = "\u5220\u9664";
const DELETE_ERROR = "\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const EMPTY_TITLE = "\u8fd8\u6ca1\u6709\u5b9a\u6295\u8bb0\u5f55";
const EMPTY_TEXT =
  "\u4f60\u53ef\u4ee5\u5148\u6dfb\u52a0\u4e00\u7b14\u4e70\u5165\uff0c\u540e\u9762\u518d\u7528\u201c\u5356\u51fa\u8bb0\u5f55\u201d\u628a\u771f\u5b9e\u7684\u5356\u51fa\u8bb0\u5f55\u8865\u8fdb\u6765\u3002";
const METRIC_POSITIONS = "\u5269\u4f59\u6301\u4ed3";
const METRIC_RECORDS = "\u603b\u8bb0\u5f55";
const METRIC_STOCKS = "\u80a1\u7968\u6301\u4ed3";
const METRIC_CRYPTOS = "\u5e01\u79cd\u6301\u4ed3";
const METRIC_COST_BASIS = "\u5269\u4f59\u672c\u91d1";
const METRIC_REALISED = "\u5df2\u5b9e\u73b0";
const METRIC_MARKET_VALUE = "\u5f53\u524d\u5e02\u503c";
const METRIC_FLOATING_PNL = "\u6d6e\u52a8\u76c8\u4e8f";
const MULTI_CURRENCY_LABEL = "\u591a\u5e01\u79cd";
const POSITIONS_SUB =
  "\u6309\u4ee3\u7801 + \u5e01\u79cd\u6c47\u603b\uff0c\u5c55\u793a\u5269\u4f59\u672c\u91d1\u3001\u5269\u4f59\u4ed3\u4f4d\u3001\u5df2\u5b9e\u73b0\u76c8\u4e8f\u548c\u672a\u5b9e\u73b0\u76c8\u4e8f\u3002";
const RECORDS_SUB =
  "\u6bcf\u4e00\u7b14\u4e70\u5165\u548c\u5356\u51fa\u90fd\u4fdd\u7559\u4e3a\u72ec\u7acb\u8bb0\u5f55\uff0c\u65b9\u4fbf\u4f60\u56de\u770b\u8282\u594f\u548c\u5356\u51fa\u7ed3\u679c\u3002";
const FILTER_EMPTY_TEXT = "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5269\u4f59\u6301\u4ed3\u3002";
const RECORD_FILTER_EMPTY_TEXT = "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684\u6d41\u6c34\u8bb0\u5f55\u3002";
const NO_PRICE_TEXT = "\u7b49\u5f85\u884c\u60c5";
const VALUE_UNAVAILABLE_TEXT = "--";
const VALUE_CURRENCY_MISMATCH_TEXT = "\u5e01\u79cd\u4e0d\u4e00\u81f4";
const POSITION_COL_TICKER = "\u6807\u7684";
const POSITION_COL_CLASS = "\u677f\u5757";
const POSITION_COL_COST = "\u5269\u4f59\u672c\u91d1";
const POSITION_COL_QUANTITY = "\u5269\u4f59\u6570\u91cf";
const POSITION_COL_AVG_COST = "\u6301\u4ed3\u5747\u4ef7";
const POSITION_COL_PRICE = "\u5f53\u524d\u4ef7";
const POSITION_COL_VALUE = "\u5f53\u524d\u5e02\u503c";
const POSITION_COL_FLOATING = "\u6d6e\u52a8\u76c8\u4e8f";
const POSITION_COL_REALISED = "\u5df2\u5b9e\u73b0";
const POSITION_COL_COUNT = "\u8bb0\u5f55\u6570";
const POSITION_COL_LAST = "\u6700\u8fd1\u4e00\u6b21";
const RECORD_COL_DATE = "\u65e5\u671f";
const RECORD_COL_SIDE = "\u7c7b\u578b";
const RECORD_COL_ASSET = "\u6807\u7684";
const RECORD_COL_AMOUNT = "\u91d1\u989d";
const RECORD_COL_QUANTITY = "\u6570\u91cf";
const RECORD_COL_PRICE = "\u5747\u4ef7";
const RECORD_COL_LIVE_PRICE = "\u5f53\u524d\u4ef7";
const RECORD_COL_REALISED = "\u5df2\u5b9e\u73b0";
const RECORD_COL_NOTE = "\u5907\u6ce8";
const RECORD_COL_ACTION = "\u64cd\u4f5c";
const ACTION_EDIT = "\u7f16\u8f91";
const ACTION_REPEAT = "\u518d\u6295";
const ACTION_DELETE = "\u5220\u9664";
const SIDE_BUY = "\u4e70\u5165";
const SIDE_SELL = "\u5356\u51fa";

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
  });
}

function getAssetClassLabel(assetClass: DcaAssetClass): string {
  return assetClass === "stock" ? FILTER_STOCK : FILTER_CRYPTO;
}

function getSideLabel(entry: Pick<DcaEntry, "side">): string {
  return entry.side === "sell" ? SIDE_SELL : SIDE_BUY;
}

function getValuationText(position: DcaPositionSummary): string {
  return position.valuationStatus === "currency-mismatch"
    ? VALUE_CURRENCY_MISMATCH_TEXT
    : VALUE_UNAVAILABLE_TEXT;
}

function buildCurrencyBreakdown(
  items: Array<{ currency: Currency; value: number }>
) {
  const totals = new Map<Currency, number>();

  items.forEach((item) => {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.value);
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

function matchesEntryFilter(entry: Pick<DcaEntry, "assetClass" | "ticker" | "name" | "notes">, filter: AssetFilter, query: string) {
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

function matchesPositionFilter(position: DcaPositionSummary, filter: AssetFilter, query: string) {
  if (filter !== "all" && position.assetClass !== filter) {
    return false;
  }

  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return (
    position.ticker.toLowerCase().includes(lowerQuery) ||
    (position.name ?? "").toLowerCase().includes(lowerQuery)
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

  const normalizedQuery = search.trim().toLowerCase();
  const { positions: allPositionSummaries, computedEntries } = useMemo(
    () => buildDcaPositionSummaries(entries),
    [entries]
  );
  const activePositions = useMemo(
    () => allPositionSummaries.filter((position) => position.remainingQuantity > 0),
    [allPositionSummaries]
  );
  const filteredEntries = useMemo(
    () =>
      computedEntries.filter((entry) => matchesEntryFilter(entry, assetFilter, normalizedQuery)),
    [assetFilter, computedEntries, normalizedQuery]
  );
  const filteredActivePositions = useMemo(
    () =>
      activePositions.filter((position) => matchesPositionFilter(position, assetFilter, normalizedQuery)),
    [activePositions, assetFilter, normalizedQuery]
  );
  const filteredPositionSummaries = useMemo(
    () =>
      allPositionSummaries.filter((position) =>
        matchesPositionFilter(position, assetFilter, normalizedQuery)
      ),
    [allPositionSummaries, assetFilter, normalizedQuery]
  );

  const remainingCostBreakdown = useMemo(
    () =>
      buildCurrencyBreakdown(
        filteredActivePositions.map((position) => ({
          currency: position.currency,
          value: position.remainingCostBasis,
        }))
      ),
    [filteredActivePositions]
  );
  const realisedBreakdown = useMemo(
    () =>
      buildCurrencyBreakdown(
        filteredPositionSummaries.map((position) => ({
          currency: position.currency,
          value: position.realisedPnl,
        }))
      ),
    [filteredPositionSummaries]
  );
  const marketValueBreakdown = useMemo(
    () =>
      buildCurrencyBreakdown(
        filteredActivePositions
          .filter((position) => position.marketValue != null)
          .map((position) => ({
            currency: position.currency,
            value: position.marketValue ?? 0,
          }))
      ),
    [filteredActivePositions]
  );
  const floatingPnlBreakdown = useMemo(
    () =>
      buildCurrencyBreakdown(
        filteredActivePositions
          .filter((position) => position.unrealizedPnl != null)
          .map((position) => ({
            currency: position.currency,
            value: position.unrealizedPnl ?? 0,
          }))
      ),
    [filteredActivePositions]
  );

  const stockPositions = activePositions.filter((position) => position.assetClass === "stock").length;
  const cryptoPositions = activePositions.filter((position) => position.assetClass === "crypto").length;
  const remainingCostText = useMemo(
    () => getBreakdownText(remainingCostBreakdown),
    [remainingCostBreakdown]
  );
  const realisedText = useMemo(
    () => getBreakdownText(realisedBreakdown),
    [realisedBreakdown]
  );
  const marketValueText = useMemo(
    () => getBreakdownText(marketValueBreakdown),
    [marketValueBreakdown]
  );
  const floatingPnlText = useMemo(
    () => getBreakdownText(floatingPnlBreakdown),
    [floatingPnlBreakdown]
  );

  function handleNewBuy() {
    setEditingEntry(null);
    setDraftValues({
      ...EMPTY_DRAFT,
      side: "buy",
      investedAt: todayInputDate(),
    });
    setDrawerOpen(true);
  }

  function handleSell(position: DcaPositionSummary) {
    setEditingEntry(null);
    setDraftValues({
      ticker: position.ticker,
      name: position.name ?? "",
      side: "sell",
      assetClass: position.assetClass,
      currency: position.currency,
      investedAt: todayInputDate(),
      investedAmount: "",
      quantity: "",
      notes: "",
    });
    setDrawerOpen(true);
  }

  function handleEdit(entry: DcaEntry) {
    setEditingEntry(entry);
    setDraftValues(null);
    setDrawerOpen(true);
  }

  function handleRepeat(entry: DcaEntry) {
    if (entry.side === "sell") return;

    const nextValues = dcaToForm(entry);
    setEditingEntry(null);
    setDraftValues({
      ...nextValues,
      side: "buy",
      investedAt: todayInputDate(),
      investedAmount: "",
      quantity: "",
      notes: "",
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
          <div className="max-w-3xl">
            <p className="text-sm text-text-muted">{PAGE_BLURB}</p>
          </div>

          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={handleNewBuy}
            className="shrink-0 self-start lg:self-auto"
          >
            {ADD_ENTRY_TEXT}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <MetricCard label={METRIC_POSITIONS} value={String(activePositions.length)} />
          <MetricCard label={METRIC_RECORDS} value={String(entries.length)} />
          <MetricCard label={METRIC_STOCKS} value={String(stockPositions)} />
          <MetricCard label={METRIC_CRYPTOS} value={String(cryptoPositions)} />
          <MetricCard
            label={METRIC_COST_BASIS}
            value={remainingCostText.display}
            hint={remainingCostText.hint}
          />
          <MetricCard
            label={METRIC_REALISED}
            value={realisedText.display}
            hint={realisedText.hint}
          />
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
            <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />} onClick={handleNewBuy}>
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
                      <th className="px-5 py-3 text-center font-medium">{POSITION_COL_TICKER}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_CLASS}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_COST}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_QUANTITY}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_AVG_COST}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_PRICE}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_VALUE}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_FLOATING}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_REALISED}</th>
                      <th className="px-4 py-3 text-center font-medium">{POSITION_COL_COUNT}</th>
                      <th className="px-5 py-3 text-center font-medium">{POSITION_COL_LAST}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivePositions.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-5 py-8 text-center text-sm text-text-muted">
                          {FILTER_EMPTY_TEXT}
                        </td>
                      </tr>
                    ) : (
                      filteredActivePositions.map((position) => (
                        <tr key={position.key} className="border-t border-border/70">
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <p className="font-medium text-text-primary">{position.ticker}</p>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  iconLeft={<Plus className="h-3.5 w-3.5" />}
                                  onClick={() => handleRepeat(position.latestBuyEntry ?? position.latestEntry)}
                                >
                                  {ACTION_REPEAT}
                                </Button>
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={() => handleSell(position)}
                                >
                                  {ADD_SELL_TEXT}
                                </Button>
                              </div>
                              {position.name && (
                                <p className="mt-1 text-xs text-text-muted">{position.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
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
                          <td className="px-4 py-4 text-center font-medium text-text-primary tabular-nums">
                            {formatCurrency(position.remainingCostBasis, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-center text-text-secondary tabular-nums">
                            {formatQuantity(position.remainingQuantity)}
                          </td>
                          <td className="px-4 py-4 text-center text-text-secondary tabular-nums">
                            {formatPrice(position.averageCost, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-center text-text-secondary tabular-nums">
                            {position.currentPrice != null
                              ? formatPrice(position.currentPrice, position.quoteCurrency ?? position.currency)
                              : NO_PRICE_TEXT}
                          </td>
                          <td className="px-4 py-4 text-center font-medium text-text-primary tabular-nums">
                            {position.marketValue != null
                              ? formatCurrency(position.marketValue, position.currency)
                              : getValuationText(position)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-4 text-center font-medium tabular-nums",
                              position.unrealizedPnl != null &&
                                position.unrealizedPnl > 0 &&
                                "text-profit",
                              position.unrealizedPnl != null &&
                                position.unrealizedPnl < 0 &&
                                "text-loss",
                              (position.unrealizedPnl == null ||
                                position.unrealizedPnl === 0) &&
                                "text-text-secondary"
                            )}
                          >
                            {position.unrealizedPnl != null ? (
                              <>
                                {position.unrealizedPnl > 0 ? "+" : ""}
                                {formatCurrency(position.unrealizedPnl, position.currency)}
                              </>
                            ) : (
                              getValuationText(position)
                            )}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-4 text-center font-medium tabular-nums",
                              position.realisedPnl > 0 && "text-profit",
                              position.realisedPnl < 0 && "text-loss",
                              position.realisedPnl === 0 && "text-text-secondary"
                            )}
                          >
                            {position.realisedPnl > 0 ? "+" : ""}
                            {formatCurrency(position.realisedPnl, position.currency)}
                          </td>
                          <td className="px-4 py-4 text-center text-text-secondary tabular-nums">
                            {position.entriesCount}
                          </td>
                          <td className="px-5 py-4 text-center text-text-secondary tabular-nums">
                            {formatDate(position.latestActivityAt)}
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
                      <th className="px-4 py-3 text-left font-medium">{RECORD_COL_SIDE}</th>
                      <th className="px-4 py-3 text-left font-medium">{RECORD_COL_ASSET}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_AMOUNT}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_QUANTITY}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_PRICE}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_LIVE_PRICE}</th>
                      <th className="px-4 py-3 text-right font-medium">{RECORD_COL_REALISED}</th>
                      <th className="px-4 py-3 text-left font-medium">{RECORD_COL_NOTE}</th>
                      <th className="px-5 py-3 text-right font-medium">{RECORD_COL_ACTION}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-8 text-center text-sm text-text-muted">
                          {RECORD_FILTER_EMPTY_TEXT}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry) => (
                        <RecordRow
                          key={entry.id}
                          entry={entry}
                          onEdit={() => handleEdit(entry)}
                          onRepeat={entry.side === "sell" ? undefined : () => handleRepeat(entry)}
                          onDelete={() => setDeleteTarget(entry)}
                        />
                      ))
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
              : `\u8fd9\u4f1a\u6c38\u4e45\u5220\u9664 ${deleteTarget.ticker} \u7684${getSideLabel(deleteTarget)}\u8bb0\u5f55\uff0c\u4e14\u65e0\u6cd5\u64a4\u9500\u3002`
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

function RecordRow({
  entry,
  onEdit,
  onRepeat,
  onDelete,
}: {
  entry: DcaComputedEntry;
  onEdit: () => void;
  onRepeat?: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t border-border/70">
      <td className="px-5 py-4 text-text-secondary tabular-nums">
        {formatDate(entry.investedAt)}
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-2xs font-medium",
            entry.side === "sell"
              ? "border-profit/20 bg-profit/10 text-profit"
              : "border-accent/20 bg-accent/10 text-accent"
          )}
        >
          {getSideLabel(entry)}
        </span>
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
          {entry.name && <p className="mt-1 text-xs text-text-muted">{entry.name}</p>}
        </div>
      </td>
      <td className="px-4 py-4 text-right font-medium text-text-primary tabular-nums">
        {formatCurrency(entry.investedAmount, entry.currency)}
      </td>
      <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
        {formatQuantity(entry.quantity)}
      </td>
      <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
        {formatPrice(entry.averagePrice, entry.currency)}
      </td>
      <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
        {entry.currentPrice != null && entry.currentPrice > 0
          ? formatPrice(entry.currentPrice, entry.quoteCurrency ?? entry.currency)
          : NO_PRICE_TEXT}
      </td>
      <td
        className={cn(
          "px-4 py-4 text-right font-medium tabular-nums",
          entry.side !== "sell" && "text-text-secondary",
          (entry.realisedPnl ?? 0) > 0 && "text-profit",
          (entry.realisedPnl ?? 0) < 0 && "text-loss"
        )}
      >
        {entry.side === "sell" && entry.realisedPnl != null
          ? `${entry.realisedPnl > 0 ? "+" : ""}${formatCurrency(entry.realisedPnl, entry.currency)}`
          : "--"}
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
            onClick={onEdit}
          >
            {ACTION_EDIT}
          </Button>
          {onRepeat && (
            <Button
              variant="secondary"
              size="xs"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
              onClick={onRepeat}
            >
              {ACTION_REPEAT}
            </Button>
          )}
          <Button
            variant="danger"
            size="xs"
            iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onDelete}
          >
            {ACTION_DELETE}
          </Button>
        </div>
      </td>
    </tr>
  );
}

const EMPTY_DRAFT: DcaFormState = {
  ticker: "",
  name: "",
  side: "buy",
  assetClass: "stock",
  currency: "USD",
  investedAt: "",
  investedAmount: "",
  quantity: "",
  notes: "",
};
