"use client";

import { useMemo } from "react";
import { useTrades } from "@/store/useTrades";
import { computeTradePnL } from "@/store/selectors";
import { cn, formatCurrency, getPnlClass } from "@/lib/utils";
import type { Trade, TradePnL } from "@/types";

// ─── Row ─────────────────────────────────────────────────────────────────────

function PerformerRow({ trade, pnl }: { trade: Trade; pnl: TradePnL }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs font-semibold text-text-primary shrink-0">
          {trade.ticker}
        </span>
        {trade.name && (
          <span className="text-xs text-text-muted truncate hidden sm:block">
            {trade.name}
          </span>
        )}
      </div>
      <div className="text-right shrink-0 ml-3">
        <p
          className={cn(
            "text-xs font-semibold tabular-nums",
            getPnlClass(pnl.net)
          )}
        >
          {pnl.net >= 0 ? "+" : ""}
          {formatCurrency(pnl.net)}
        </p>
        <p
          className={cn(
            "text-2xs tabular-nums",
            getPnlClass(pnl.percent)
          )}
        >
          {pnl.percent >= 0 ? "+" : ""}
          {pnl.percent.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PerformersTable() {
  const trades = useTrades((s) => s.trades);

  const ranked = useMemo(() => {
    return trades
      .filter((t) => t.status === "closed")
      .map((t) => ({ trade: t, pnl: computeTradePnL(t) }))
      .filter(
        (x): x is { trade: Trade; pnl: TradePnL } => x.pnl !== null
      )
      .sort((a, b) => b.pnl.net - a.pnl.net);
  }, [trades]);

  if (ranked.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-text-muted">
        暂无已平仓交易
      </div>
    );
  }

  const best = ranked.slice(0, 5);
  const worst = [...ranked].reverse().slice(0, 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Best performers */}
      <div>
        <p className="text-xs font-semibold text-profit uppercase tracking-wider mb-3">
          最佳表现
        </p>
        {best.map(({ trade, pnl }) => (
          <PerformerRow key={trade.id} trade={trade} pnl={pnl} />
        ))}
      </div>

      {/* Worst performers */}
      <div>
        <p className="text-xs font-semibold text-loss uppercase tracking-wider mb-3">
          最差表现
        </p>
        {worst.map(({ trade, pnl }) => (
          <PerformerRow key={trade.id} trade={trade} pnl={pnl} />
        ))}
      </div>
    </div>
  );
}
