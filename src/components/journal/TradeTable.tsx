"use client";

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  cn,
  formatCurrency,
  formatDateTime,
  formatHoldingDuration,
  getHoldingDurationMs,
  getPnlClass,
} from "@/lib/utils";
import { computeTradePnL, computeUnrealisedPnL } from "@/store/selectors";
import type { Trade, TradePnL } from "@/types";

export type SortField =
  | "entryDate"
  | "exitDate"
  | "ticker"
  | "duration"
  | "pnl"
  | "pnlPercent"
  | "quantity";

export type SortDir = "asc" | "desc";

function getDisplayPnL(trade: Trade): TradePnL | null {
  if (trade.status === "closed") return computeTradePnL(trade);
  if (trade.currentPrice != null) {
    return computeUnrealisedPnL(trade, trade.currentPrice);
  }
  return null;
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3 h-3" />
  ) : (
    <ChevronDown className="w-3 h-3" />
  );
}

function Th({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;

  return (
    <th
      className={cn(
        "px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted",
        className
      )}
    >
      <button
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center justify-center gap-1 hover:text-text-secondary transition-colors",
          isActive && "text-text-secondary"
        )}
      >
        {label}
        <SortIcon active={isActive} dir={sortDir} />
      </button>
    </th>
  );
}

function GroupRow({
  label,
  count,
  tone,
  colSpan,
}: {
  label: string;
  count: number;
  tone: "accent" | "neutral";
  colSpan: number;
}) {
  return (
    <tr className="bg-surface-2/85">
      <td colSpan={colSpan} className="px-4 py-2.5 border-y border-border">
        <div className="flex items-center justify-center gap-2 text-center">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              tone === "accent" ? "bg-accent" : "bg-text-muted"
            )}
          />
          <span className="text-xs font-semibold tracking-[0.18em] uppercase text-text-secondary">
            {label}
          </span>
          <span className="text-xs text-text-muted tabular-nums">{count}</span>
        </div>
      </td>
    </tr>
  );
}

function TradeRow({
  trade,
  onEdit,
  onDelete,
}: {
  trade: Trade;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}) {
  const pnl = getDisplayPnL(trade);
  const isOpen = trade.status === "open";
  const duration = formatHoldingDuration(
    getHoldingDurationMs(trade.entryDate, trade.exitDate)
  );

  return (
    <tr className="border-b border-border/70 hover:bg-surface-2/70 transition-colors group odd:bg-surface-1/70">
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <p className="font-mono text-sm font-semibold text-text-primary">
          {trade.ticker}
        </p>
        {trade.name && (
          <p className="text-2xs text-text-muted truncate max-w-[160px] mt-1 mx-auto">
            {trade.name}
          </p>
        )}
      </td>

      <td className="px-4 py-4 whitespace-nowrap text-center">
        <div className="flex justify-center">
          <Badge variant={trade.direction === "long" ? "profit" : "loss"}>
            {trade.direction === "long" ? "做多" : "做空"}
          </Badge>
        </div>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell text-center">
        <div className="flex justify-center">
          <Badge variant="outline" className="capitalize">
            {trade.assetClass}
          </Badge>
        </div>
      </td>

      <td className="px-4 py-4 whitespace-nowrap text-center">
        <div className="flex justify-center">
          <Badge variant={isOpen ? "accent" : "default"} dot>
            {isOpen ? "持仓中" : "已平仓"}
          </Badge>
        </div>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell text-center">
        <p className="text-xs text-text-secondary">{formatDateTime(trade.entryDate)}</p>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell text-center">
        <p className="text-xs text-text-secondary">
          {trade.exitDate ? formatDateTime(trade.exitDate) : "--"}
        </p>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell text-center">
        <p className="text-xs font-medium text-text-secondary tabular-nums">
          {duration}
        </p>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden xl:table-cell text-center">
        <p className="text-xs text-text-secondary tabular-nums">
          {formatCurrency(trade.entryPrice, trade.currency)}
        </p>
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden xl:table-cell text-center">
        <p className="text-xs text-text-secondary tabular-nums">
          {trade.exitPrice
            ? formatCurrency(trade.exitPrice, trade.currency)
            : isOpen && trade.currentPrice
              ? formatCurrency(trade.currentPrice, trade.currency)
              : "--"}
        </p>
        {isOpen && trade.currentPrice && (
          <p className="text-2xs text-text-muted mt-1">当前价</p>
        )}
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden xl:table-cell text-center">
        <p className="text-xs text-text-secondary tabular-nums">
          {trade.quantity.toLocaleString()}
        </p>
      </td>

      <td className="px-4 py-4 whitespace-nowrap text-center">
        {pnl ? (
          <div>
            <p className={cn("text-sm font-semibold tabular-nums", getPnlClass(pnl.net))}>
              {pnl.net > 0 ? "+" : ""}
              {formatCurrency(pnl.net)}
            </p>
            {isOpen && <p className="text-2xs text-text-muted mt-1">未实现</p>}
          </div>
        ) : (
          <p className="text-xs text-text-muted">--</p>
        )}
      </td>

      <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell text-center">
        {pnl ? (
          <p
            className={cn(
              "text-xs tabular-nums font-semibold",
              getPnlClass(pnl.percent)
            )}
          >
            {pnl.percent > 0 ? "+" : ""}
            {pnl.percent.toFixed(2)}%
          </p>
        ) : (
          <p className="text-xs text-text-muted">--</p>
        )}
      </td>

      <td className="px-4 py-4 whitespace-nowrap text-center">
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(trade)}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-surface-3 transition-colors"
            aria-label="Edit trade"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(trade)}
            className="p-1.5 rounded-lg text-text-muted hover:text-loss hover:bg-surface-3 transition-colors"
            aria-label="Delete trade"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

interface TradeTableProps {
  trades: Trade[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}

export function TradeTable({
  trades,
  sortField,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: TradeTableProps) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 gap-2">
        <p className="text-sm text-text-muted">没有符合筛选条件的交易。</p>
        <p className="text-xs text-text-muted">试试调整上面的筛选条件。</p>
      </div>
    );
  }

  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const thProps = { sortField, sortDir, onSort };
  const columnCount = 13;

  return (
    <div className="overflow-auto max-h-[72vh]">
      <table className="w-full min-w-[1180px]">
        <thead className="bg-surface-1/95 border-b border-border sticky top-0 z-20 backdrop-blur-md">
          <tr>
            <Th field="ticker" label="代码" {...thProps} className="w-40" />
            <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted w-20">
              方向
            </th>
            <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted hidden sm:table-cell w-24">
              类别
            </th>
            <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted w-24">
              状态
            </th>
            <Th
              field="entryDate"
              label="入场时间"
              {...thProps}
              className="hidden md:table-cell"
            />
            <Th
              field="exitDate"
              label="出场时间"
              {...thProps}
              className="hidden md:table-cell"
            />
            <Th
              field="duration"
              label="持仓时长"
              {...thProps}
              className="hidden lg:table-cell"
            />
            <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted hidden xl:table-cell">
              入场价
            </th>
            <th className="px-4 py-3 text-center text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted hidden xl:table-cell">
              出场价
            </th>
            <Th
              field="quantity"
              label="数量"
              {...thProps}
              className="hidden xl:table-cell"
            />
            <Th field="pnl" label="盈亏" {...thProps} />
            <Th
              field="pnlPercent"
              label="盈亏%"
              {...thProps}
              className="hidden sm:table-cell"
            />
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>

        <tbody>
          {openTrades.length > 0 && (
            <GroupRow
              label="持仓中"
              count={openTrades.length}
              tone="accent"
              colSpan={columnCount}
            />
          )}
          {openTrades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}

          {closedTrades.length > 0 && (
            <GroupRow
              label="已平仓"
              count={closedTrades.length}
              tone="neutral"
              colSpan={columnCount}
            />
          )}
          {closedTrades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
