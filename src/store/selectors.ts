import { useMemo } from "react";
import { useTrades } from "./useTrades";
import { useThoughts } from "./useThoughts";
import { usePortfolioSettings } from "./usePortfolioSettings";
import type {
  ActivityItem,
  AssetBreakdown,
  AssetClass,
  DurationBucket,
  EquityPoint,
  MonthlyPnl,
  PortfolioAllocation,
  PortfolioStats,
  TagStats,
  Thought,
  Trade,
  TradePnL,
} from "@/types";

export function computeTradePnL(trade: Trade): TradePnL | null {
  if (trade.status !== "closed" || trade.exitPrice == null) return null;

  const { direction, entryPrice, exitPrice, quantity, fees } = trade;
  const multiplier = direction === "long" ? 1 : -1;
  const gross = multiplier * (exitPrice - entryPrice) * quantity;
  const net = gross - (fees ?? 0);
  const invested = entryPrice * quantity;
  const percent = invested === 0 ? 0 : (net / invested) * 100;

  return { gross, net, percent, isWin: net > 0 };
}

export function computeUnrealisedPnL(
  trade: Trade,
  currentPrice: number
): TradePnL {
  const { direction, entryPrice, quantity, fees } = trade;
  const multiplier = direction === "long" ? 1 : -1;
  const gross = multiplier * (currentPrice - entryPrice) * quantity;
  const net = gross - (fees ?? 0);
  const invested = entryPrice * quantity;
  const percent = invested === 0 ? 0 : (net / invested) * 100;

  return { gross, net, percent, isWin: net > 0 };
}

export function computePortfolioStats(trades: Trade[]): PortfolioStats {
  const closed = trades.filter((trade) => trade.status === "closed");
  const open = trades.filter((trade) => trade.status === "open");

  const pnls = closed
    .map((trade) => ({ trade, pnl: computeTradePnL(trade) }))
    .filter((item): item is { trade: Trade; pnl: TradePnL } => item.pnl !== null);

  const wins = pnls.filter((item) => item.pnl.isWin);
  const losses = pnls.filter((item) => !item.pnl.isWin);

  const totalNetPnl = pnls.reduce((sum, item) => sum + item.pnl.net, 0);
  const totalGrossPnl = pnls.reduce((sum, item) => sum + item.pnl.gross, 0);
  const totalWins = wins.reduce((sum, item) => sum + item.pnl.net, 0);
  const totalLosses = Math.abs(
    losses.reduce((sum, item) => sum + item.pnl.net, 0)
  );

  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const profitFactor =
    totalLosses === 0 ? (totalWins > 0 ? Infinity : 1) : totalWins / totalLosses;
  const expectancy = pnls.length > 0 ? totalNetPnl / pnls.length : 0;

  let bestTrade: Trade | null = null;
  let worstTrade: Trade | null = null;

  if (pnls.length > 0) {
    bestTrade = pnls.reduce((a, b) => (b.pnl.net > a.pnl.net ? b : a)).trade;
    worstTrade = pnls.reduce((a, b) => (b.pnl.net < a.pnl.net ? b : a)).trade;
  }

  const totalInvested = closed.reduce(
    (sum, trade) => sum + trade.entryPrice * trade.quantity,
    0
  );

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: open.length,
    winRate: pnls.length > 0 ? (wins.length / pnls.length) * 100 : 0,
    totalNetPnl,
    totalGrossPnl,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    profitFactor,
    expectancy,
    deployedCapital: open.reduce(
      (sum, trade) => sum + trade.entryPrice * trade.quantity,
      0
    ),
    totalInvested,
    pnlPercent: totalInvested > 0 ? (totalNetPnl / totalInvested) * 100 : 0,
  };
}

export function computeEquityCurve(
  trades: Trade[],
  initialCapital = 0
): EquityPoint[] {
  const closed = trades
    .filter((trade) => trade.status === "closed" && trade.exitDate)
    .sort((a, b) => a.exitDate!.localeCompare(b.exitDate!));

  let cumPnl = 0;
  const points: EquityPoint[] = [];

  for (const trade of closed) {
    const pnl = computeTradePnL(trade);
    if (!pnl) continue;

    cumPnl += pnl.net;
    points.push({
      date: trade.exitDate!,
      cumPnl: Math.round(cumPnl * 100) / 100,
      nav: Math.round((initialCapital + cumPnl) * 100) / 100,
      trades: points.length + 1,
    });
  }

  return points;
}

export function computeMonthlyPnl(trades: Trade[]): MonthlyPnl[] {
  const map = new Map<string, { pnl: number; trades: number }>();

  for (const trade of trades) {
    if (trade.status !== "closed" || !trade.exitDate) continue;

    const pnl = computeTradePnL(trade);
    if (!pnl) continue;

    const month = trade.exitDate.slice(0, 7);
    const existing = map.get(month) ?? { pnl: 0, trades: 0 };

    map.set(month, {
      pnl: existing.pnl + pnl.net,
      trades: existing.trades + 1,
    });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { pnl, trades }]) => {
      const [year, mo] = month.split("-");
      const label = new Date(Number(year), Number(mo) - 1, 1).toLocaleDateString(
        "en-US",
        { month: "short", year: "2-digit" }
      );

      return {
        month,
        label,
        pnl: Math.round(pnl * 100) / 100,
        trades,
      };
    });
}

export function computeAssetBreakdown(trades: Trade[]): AssetBreakdown[] {
  const map = new Map<AssetClass, { count: number; pnl: number }>();

  for (const trade of trades) {
    const pnl = computeTradePnL(trade);
    const net = pnl?.net ?? 0;
    const existing = map.get(trade.assetClass) ?? { count: 0, pnl: 0 };

    map.set(trade.assetClass, {
      count: existing.count + 1,
      pnl: existing.pnl + net,
    });
  }

  const totalAbs = Array.from(map.values()).reduce(
    (sum, { pnl }) => sum + Math.abs(pnl),
    0
  );

  return Array.from(map.entries()).map(([assetClass, { count, pnl }]) => ({
    assetClass,
    count,
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent:
      totalAbs === 0 ? 0 : Math.round((Math.abs(pnl) / totalAbs) * 1000) / 10,
  }));
}

export function computePortfolioAllocation(
  trades: Trade[],
  initialCapital: number
): PortfolioAllocation[] {
  const openTrades = trades.filter((trade) => trade.status === "open");
  const realisedPnl = trades
    .filter((trade) => trade.status === "closed")
    .reduce((sum, trade) => sum + (computeTradePnL(trade)?.net ?? 0), 0);

  const allocationMap = new Map<
    AssetClass,
    { label: string; value: number; count: number }
  >();

  const assetLabels: Record<AssetClass, string> = {
    stock: "股票",
    etf: "ETF",
    crypto: "加密货币",
    forex: "外汇",
    futures: "期货",
    option: "期权",
    other: "其他",
  };

  let openCostBasis = 0;

  for (const trade of openTrades) {
    const marketValue = (trade.currentPrice ?? trade.entryPrice) * trade.quantity;
    const costBasis = trade.entryPrice * trade.quantity;
    const existing = allocationMap.get(trade.assetClass) ?? {
      label: assetLabels[trade.assetClass],
      value: 0,
      count: 0,
    };

    allocationMap.set(trade.assetClass, {
      ...existing,
      value: existing.value + marketValue,
      count: existing.count + 1,
    });

    openCostBasis += costBasis;
  }

  const cashValue = Math.max(initialCapital + realisedPnl - openCostBasis, 0);

  const rows: PortfolioAllocation[] = Array.from(allocationMap.entries()).map(
    ([assetClass, entry]) => ({
      key: assetClass,
      label: entry.label,
      value: Math.round(entry.value * 100) / 100,
      percent: 0,
      count: entry.count,
    })
  );

  rows.push({
    key: "cash",
    label: "现金 / 本位",
    value: Math.round(cashValue * 100) / 100,
    percent: 0,
  });

  const total = rows.reduce((sum, item) => sum + item.value, 0);

  return rows
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeRecentActivity(
  trades: Trade[],
  thoughts: Thought[],
  limit = 8
): ActivityItem[] {
  const tradeItems: ActivityItem[] = trades.map((trade) => ({
    kind: "trade",
    date: trade.updatedAt,
    item: trade,
  }));

  const thoughtItems: ActivityItem[] = thoughts.map((thought) => ({
    kind: "thought",
    date: thought.updatedAt,
    item: thought,
  }));

  return [...tradeItems, ...thoughtItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function usePortfolioStats(): PortfolioStats {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computePortfolioStats(trades), [trades]);
}

export function useEquityCurve(): EquityPoint[] {
  const trades = useTrades((state) => state.trades);
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);

  return useMemo(
    () => computeEquityCurve(trades, initialCapital),
    [initialCapital, trades]
  );
}

export function useMonthlyPnl(): MonthlyPnl[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeMonthlyPnl(trades), [trades]);
}

export function useAssetBreakdown(): AssetBreakdown[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeAssetBreakdown(trades), [trades]);
}

export function usePortfolioAllocation(): PortfolioAllocation[] {
  const trades = useTrades((state) => state.trades);
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);

  return useMemo(
    () => computePortfolioAllocation(trades, initialCapital),
    [initialCapital, trades]
  );
}

export function useRecentActivity(limit = 8): ActivityItem[] {
  const trades = useTrades((state) => state.trades);
  const thoughts = useThoughts((state) => state.thoughts);

  return useMemo(
    () => computeRecentActivity(trades, thoughts, limit),
    [limit, thoughts, trades]
  );
}

export function useTradePnL(trade: Trade): TradePnL | null {
  return useMemo(() => computeTradePnL(trade), [trade]);
}

export function useOpenTrades(): Trade[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => trades.filter((trade) => trade.status === "open"), [trades]);
}

export function useClosedTrades(): Trade[] {
  const trades = useTrades((state) => state.trades);

  return useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "closed")
        .sort((a, b) => (b.exitDate ?? "").localeCompare(a.exitDate ?? "")),
    [trades]
  );
}

export function computeMaxDrawdown(points: EquityPoint[]): number {
  if (points.length < 2) return 0;

  let peak = points[0].cumPnl;
  let maxDrawdown = 0;

  for (const point of points) {
    if (point.cumPnl > peak) peak = point.cumPnl;

    const drawdown = point.cumPnl - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

export function useMaxDrawdown(): number {
  const equityCurve = useEquityCurve();
  return useMemo(() => computeMaxDrawdown(equityCurve), [equityCurve]);
}

export function useRecentTrades(limit = 5): Trade[] {
  const trades = useTrades((state) => state.trades);

  return useMemo(
    () =>
      [...trades]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    [limit, trades]
  );
}

export function computeTagStats(trades: Trade[]): TagStats[] {
  const map = new Map<string, { wins: number; losses: number; totalPnl: number }>();

  for (const trade of trades) {
    if (trade.status !== "closed") continue;

    const pnl = computeTradePnL(trade);
    if (!pnl) continue;

    for (const tag of trade.tags) {
      const existing = map.get(tag) ?? { wins: 0, losses: 0, totalPnl: 0 };

      map.set(tag, {
        wins: existing.wins + (pnl.isWin ? 1 : 0),
        losses: existing.losses + (pnl.isWin ? 0 : 1),
        totalPnl: existing.totalPnl + pnl.net,
      });
    }
  }

  return Array.from(map.entries())
    .map(([tag, { wins, losses, totalPnl }]) => {
      const total = wins + losses;

      return {
        tag,
        total,
        wins,
        losses,
        winRate: total > 0 ? (wins / total) * 100 : 0,
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgPnl: total > 0 ? Math.round((totalPnl / total) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export function computeAvgHoldingDays(trades: Trade[]): number {
  const closed = trades.filter((trade) => trade.status === "closed" && trade.exitDate);
  if (closed.length === 0) return 0;

  const totalDays = closed.reduce((sum, trade) => {
    const days =
      (new Date(trade.exitDate!).getTime() - new Date(trade.entryDate).getTime()) /
      86400000;

    return sum + days;
  }, 0);

  return Math.round(totalDays / closed.length);
}

const DURATION_BUCKETS: Array<Omit<DurationBucket, "count">> = [
  { label: "1d", minDays: 0, maxDays: 1 },
  { label: "2-7d", minDays: 2, maxDays: 7 },
  { label: "1-4w", minDays: 8, maxDays: 28 },
  { label: "1-3m", minDays: 29, maxDays: 90 },
  { label: "3m+", minDays: 91, maxDays: 1e9 },
];

export function computeDurationBuckets(trades: Trade[]): DurationBucket[] {
  const buckets = DURATION_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));

  for (const trade of trades) {
    if (trade.status !== "closed" || !trade.exitDate) continue;

    const days = Math.floor(
      (new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) /
        86400000
    );

    const bucket = buckets.find(
      (item) => days >= item.minDays && days <= item.maxDays
    );

    if (bucket) bucket.count++;
  }

  return buckets;
}

export function computeTotalFees(trades: Trade[]): number {
  return Math.round(
    trades.reduce((sum, trade) => sum + (trade.fees ?? 0), 0) * 100
  ) / 100;
}

export function useTagStats(): TagStats[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeTagStats(trades), [trades]);
}

export function useAvgHoldingDays(): number {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeAvgHoldingDays(trades), [trades]);
}

export function useDurationBuckets(): DurationBucket[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeDurationBuckets(trades), [trades]);
}

export function useTotalFees(): number {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeTotalFees(trades), [trades]);
}
