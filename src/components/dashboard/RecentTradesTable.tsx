"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRecentTrades, computeTradePnL } from "@/store/selectors";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, getPnlClass } from "@/lib/utils";
import type { Trade } from "@/types";
import { cn } from "@/lib/utils";

function TradeRow({ trade }: { trade: Trade }) {
  const pnl = computeTradePnL(trade);

  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-surface-2 transition-colors border-b border-border last:border-0">
      {/* Left: ticker + badges */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0">
          <p className="font-mono text-sm font-medium text-text-primary leading-tight">
            {trade.ticker}
          </p>
          <p className="text-2xs text-text-muted truncate max-w-[80px]">
            {trade.name ?? trade.assetClass}
          </p>
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <Badge variant={trade.direction === "long" ? "profit" : "loss"}>
            {trade.direction === "long" ? "做多" : "做空"}
          </Badge>
          <Badge variant={trade.status === "open" ? "accent" : "default"} dot>
            {trade.status === "open" ? "持仓" : "平仓"}
          </Badge>
        </div>
      </div>

      {/* Right: P&L */}
      <div className="shrink-0 text-right">
        {pnl ? (
          <>
            <p className={cn("text-sm font-semibold tabular-nums", getPnlClass(pnl.net))}>
              {pnl.net > 0 ? "+" : ""}{formatCurrency(pnl.net)}
            </p>
            <p className={cn("text-2xs tabular-nums", getPnlClass(pnl.percent))}>
              {pnl.percent > 0 ? "+" : ""}{pnl.percent.toFixed(1)}%
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-text-muted">持仓中</p>
            <p className="text-2xs text-text-muted">{formatDate(trade.entryDate)}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RecentTradesTable() {
  const trades = useRecentTrades(5);

  return (
    <div>
      {trades.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-text-muted">
          暂无交易记录
        </div>
      ) : (
        <div>
          {trades.map((t) => (
            <TradeRow key={t.id} trade={t} />
          ))}

          <div className="px-5 py-3">
            <Link
              href="/journal"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors"
            >
              查看全部交易
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
