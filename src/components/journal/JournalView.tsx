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
  const pnls = closedTrades
    .map((trade) => computeTradePnL(trade))
    .filter(Boolean) as NonNullable<ReturnType<typeof computeTradePnL>>[];

  const totalPnl = pnls.reduce((sum, pnl) => sum + pnl.net, 0);
  const wins = pnls.filter((pnl) => pnl.isWin).length;
  const winRate = pnls.length > 0 ? (wins / pnls.length) * 100 : null;

  if (trades.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border bg-surface-2/50 px-5 py-3">
      <span className="text-xs text-text-muted">
        <span className="font-medium text-text-secondary">{openTrades.length}</span>
        {" 持仓中 · "}
        <span className="font-medium text-text-secondary">{closedTrades.length}</span>
        {" 已平仓"}
      </span>

      {pnls.length > 0 && (
        <span className="text-xs text-text-muted">
          已实现盈亏:
          <span
            className={`ml-1 font-medium text-sm tabular-nums ${
              totalPnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {totalPnl > 0 ? "+" : ""}
            {formatCurrency(totalPnl)}
          </span>
        </span>
      )}

      {winRate !== null && (
        <span className="text-xs text-text-muted">
          胜率:
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
      setDeleteError((err as Error).message || "删除失败，请稍后重试");
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
            新增交易
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
        title="删除交易？"
        description={
          deleteTarget
            ? deleteError
              ? `删除失败: ${deleteError}`
              : `这会永久删除 ${deleteTarget.ticker} 的交易记录，且无法撤销。`
            : undefined
        }
        confirmLabel="删除"
        confirmVariant="danger"
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        loading={deleting}
      />
    </>
  );
}
