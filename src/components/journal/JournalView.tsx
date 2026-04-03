"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { deleteTradeFromServer } from "@/lib/server-sync-client";
import { formatCurrency, getHoldingDurationMs } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { computeTradePnL, computeUnrealisedPnL } from "@/store/selectors";
import { useTrades } from "@/store/useTrades";
import type { Trade } from "@/types";
import { TradeDrawer } from "./TradeDrawer";
import {
  DEFAULT_FILTERS,
  TradeFilters,
  type HoldingDurationFilter,
  type JournalFilters,
} from "./TradeFilters";
import { TradeTable } from "./TradeTable";
import type { SortDir, SortField } from "./TradeTable";

const OPEN_TRADES_TEXT = "\u6301\u4ed3\u4e2d";
const CLOSED_TRADES_TEXT = "\u5df2\u5e73\u4ed3";
const REALISED_TEXT = "\u5df2\u5b9e\u73b0";
const UNREALISED_TEXT = "\u672a\u5b9e\u73b0";
const TOTAL_PNL_TEXT = "\u603b\u76c8\u4e8f";
const WIN_RATE_TEXT = "\u80dc\u7387";
const DELETE_ERROR_TEXT = "\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const ADD_TRADE_TEXT = "\u65b0\u589e\u4ea4\u6613";
const DELETE_DIALOG_TITLE = "\u5220\u9664\u4ea4\u6613\uff1f";
const DELETE_LABEL = "\u5220\u9664";

function getPnlNet(trade: Trade): number {
  if (trade.status === "closed") return computeTradePnL(trade)?.net ?? 0;
  if (trade.currentPrice != null) {
    return computeUnrealisedPnL(trade, trade.currentPrice).net;
  }
  return 0;
}

function getPnlPct(trade: Trade): number {
  if (trade.status === "closed") return computeTradePnL(trade)?.percent ?? 0;
  if (trade.currentPrice != null) {
    return computeUnrealisedPnL(trade, trade.currentPrice).percent;
  }
  return 0;
}

function getDurationMs(trade: Trade): number {
  return getHoldingDurationMs(trade.entryDate, trade.exitDate) ?? 0;
}

function compareByField(a: Trade, b: Trade, field: SortField, dir: SortDir): number {
  const multiplier = dir === "asc" ? 1 : -1;

  switch (field) {
    case "ticker":
      return multiplier * a.ticker.localeCompare(b.ticker);
    case "entryDate":
      return multiplier * a.entryDate.localeCompare(b.entryDate);
    case "exitDate":
      return multiplier * (a.exitDate ?? "").localeCompare(b.exitDate ?? "");
    case "duration":
      return multiplier * (getDurationMs(a) - getDurationMs(b));
    case "pnl":
      return multiplier * (getPnlNet(a) - getPnlNet(b));
    case "pnlPercent":
      return multiplier * (getPnlPct(a) - getPnlPct(b));
    case "quantity":
      return multiplier * (a.quantity - b.quantity);
    default:
      return 0;
  }
}

function sortTrades(trades: Trade[], field: SortField, dir: SortDir): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "open" ? -1 : 1;
    }

    const fieldDiff = compareByField(a, b, field, dir);
    if (fieldDiff !== 0) return fieldDiff;

    if (a.status === "open") {
      return b.entryDate.localeCompare(a.entryDate);
    }

    return (b.exitDate ?? "").localeCompare(a.exitDate ?? "");
  });
}

function matchesHoldingDuration(trade: Trade, filter: HoldingDurationFilter): boolean {
  if (filter === "all") return true;

  const durationMs = getHoldingDurationMs(trade.entryDate, trade.exitDate);
  if (durationMs == null) return false;

  const hours = durationMs / 3600000;
  const days = durationMs / 86400000;

  switch (filter) {
    case "lt1h":
      return hours < 1;
    case "h1to24":
      return hours >= 1 && hours < 24;
    case "d1to3":
      return days >= 1 && days < 3;
    case "d3to7":
      return days >= 3 && days <= 7;
    case "gt7d":
      return days > 7;
    default:
      return true;
  }
}

function filterTrades(trades: Trade[], filters: JournalFilters): Trade[] {
  const query = filters.search.toLowerCase();
  const startDate = filters.dateFrom
    ? new Date(`${filters.dateFrom}T00:00`).getTime()
    : null;
  const endDate = filters.dateTo
    ? new Date(`${filters.dateTo}T23:59:59`).getTime()
    : null;

  return trades.filter((trade) => {
    if (
      query &&
      !trade.ticker.toLowerCase().includes(query) &&
      !trade.name?.toLowerCase().includes(query) &&
      !trade.tags.some((tag) => tag.toLowerCase().includes(query))
    ) {
      return false;
    }

    if (filters.status !== "all" && trade.status !== filters.status) return false;
    if (filters.direction !== "all" && trade.direction !== filters.direction) return false;
    if (filters.assetClass !== "all" && trade.assetClass !== filters.assetClass) return false;
    if (!matchesHoldingDuration(trade, filters.holdingDuration)) return false;

    if (filters.pnl !== "all") {
      let pnl = computeTradePnL(trade);
      if (!pnl && trade.status === "open" && trade.currentPrice != null) {
        pnl = computeUnrealisedPnL(trade, trade.currentPrice);
      }

      if (filters.pnl === "win" && (!pnl || !pnl.isWin)) return false;
      if (filters.pnl === "loss" && (!pnl || pnl.isWin)) return false;
    }

    const entryTime = new Date(trade.entryDate).getTime();
    if (startDate != null && entryTime < startDate) return false;
    if (endDate != null && entryTime > endDate) return false;

    return true;
  });
}

function SummaryBar({ trades }: { trades: Trade[] }) {
  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const realisedPnls = closedTrades
    .map((trade) => computeTradePnL(trade))
    .filter(Boolean) as NonNullable<ReturnType<typeof computeTradePnL>>[];
  const unrealisedPnls = openTrades
    .map((trade) =>
      trade.currentPrice != null ? computeUnrealisedPnL(trade, trade.currentPrice) : null
    )
    .filter(Boolean) as NonNullable<ReturnType<typeof computeUnrealisedPnL>>[];

  const realisedPnl = realisedPnls.reduce((sum, pnl) => sum + pnl.net, 0);
  const unrealisedPnl = unrealisedPnls.reduce((sum, pnl) => sum + pnl.net, 0);
  const combinedPnl = realisedPnl + unrealisedPnl;
  const wins = realisedPnls.filter((pnl) => pnl.isWin).length;
  const winRate = realisedPnls.length > 0 ? (wins / realisedPnls.length) * 100 : null;

  if (trades.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border bg-surface-2/50 px-5 py-3">
      <span className="text-xs text-text-muted">
        <span className="font-medium text-text-secondary">{openTrades.length}</span>
        {` ${OPEN_TRADES_TEXT} · `}
        <span className="font-medium text-text-secondary">{closedTrades.length}</span>
        {` ${CLOSED_TRADES_TEXT}`}
      </span>

      {realisedPnls.length > 0 && (
        <span className="text-xs text-text-muted">
          {REALISED_TEXT}
          <span
            className={`ml-1 font-medium text-sm tabular-nums ${
              realisedPnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {realisedPnl > 0 ? "+" : ""}
            {formatCurrency(realisedPnl)}
          </span>
        </span>
      )}

      {unrealisedPnls.length > 0 && (
        <span className="text-xs text-text-muted">
          {UNREALISED_TEXT}
          <span
            className={`ml-1 font-medium text-sm tabular-nums ${
              unrealisedPnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {unrealisedPnl > 0 ? "+" : ""}
            {formatCurrency(unrealisedPnl)}
          </span>
        </span>
      )}

      {(realisedPnls.length > 0 || unrealisedPnls.length > 0) && (
        <span className="text-xs text-text-muted">
          {TOTAL_PNL_TEXT}
          <span
            className={`ml-1 font-medium text-sm tabular-nums ${
              combinedPnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {combinedPnl > 0 ? "+" : ""}
            {formatCurrency(combinedPnl)}
          </span>
        </span>
      )}

      {winRate !== null && (
        <span className="text-xs text-text-muted">
          {WIN_RATE_TEXT}:
          <span className="ml-1 font-medium text-text-secondary">
            {winRate.toFixed(1)}%
          </span>
        </span>
      )}
    </div>
  );
}

export function JournalView() {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const trades = useTrades((state) => state.trades);
  const removeTrade = useTrades((state) => state.deleteTrade);
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>("exitDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => filterTrades(trades, filters), [trades, filters]);
  const sorted = useMemo(
    () => sortTrades(filtered, sortField, sortDir),
    [filtered, sortField, sortDir]
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir("desc");
  }

  function handleEdit(trade: Trade) {
    setEditingTrade(trade);
    setDrawerOpen(true);
  }

  function handleNew() {
    setEditingTrade(null);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setEditingTrade(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await deleteTradeFromServer(activeUserId, deleteTarget.id);
      removeTrade(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError((err as Error).message || DELETE_ERROR_TEXT);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <TradeFilters
            filters={filters}
            onChange={setFilters}
            totalCount={trades.length}
            filteredCount={filtered.length}
          />

          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={handleNew}
            className="mt-0.5 shrink-0"
          >
            {ADD_TRADE_TEXT}
          </Button>
        </div>

        <Card noPadding className="overflow-hidden">
          <SummaryBar trades={sorted} />
          <TradeTable
            trades={sorted}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={(trade) => setDeleteTarget(trade)}
          />
        </Card>
      </div>

      <TradeDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        editingTrade={editingTrade}
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
              : `\u8fd9\u4f1a\u6c38\u4e45\u5220\u9664 ${deleteTarget.ticker} \u7684\u4ea4\u6613\u8bb0\u5f55\uff0c\u4e14\u65e0\u6cd5\u64a4\u9500\u3002`
            : undefined
        }
        confirmLabel={DELETE_LABEL}
        confirmVariant="danger"
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        loading={deleting}
      />
    </>
  );
}
