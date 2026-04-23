import { useMemo } from "react";
import { buildDcaPositionSummaries, getDcaEntrySide } from "@/lib/dca";
import { useTrades } from "./useTrades";
import { useThoughts } from "./useThoughts";
import { usePortfolioSettings } from "./usePortfolioSettings";
import { useDcaEntries } from "./useDcaEntries";
import type {
  ActivityItem,
  AssetBreakdown,
  AssetClass,
  DcaEntry,
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

function isDashboardDcaEntry(entry: DcaEntry): boolean {
  return entry.currency === "USD" && (!entry.quoteCurrency || entry.quoteCurrency === "USD");
}

function computeDcaUnrealisedPnL(entries: DcaEntry[]) {
  const { positions, computedEntries } = buildDcaPositionSummaries(entries.filter(isDashboardDcaEntry));
  const activePositions = positions.filter((position) => position.remainingQuantity > 0);
  const dcaInvested = activePositions.reduce(
    (sum, position) => sum + position.remainingCostBasis,
    0
  );
  const dcaMarketValue = activePositions.reduce(
    (sum, position) => sum + position.marketValue,
    0
  );
  const dcaUnrealisedNetPnl = activePositions.reduce(
    (sum, position) => sum + position.unrealizedPnl,
    0
  );
  const dcaRealisedNetPnl = computedEntries.reduce(
    (sum, entry) => sum + (entry.side === "sell" ? entry.realisedPnl ?? 0 : 0),
    0
  );
  const dcaPositions = activePositions.length;

  return {
    dcaInvested,
    dcaMarketValue,
    dcaUnrealisedNetPnl,
    dcaRealisedNetPnl,
    dcaPositions,
  };
}

export function computePortfolioStats(
  trades: Trade[],
  dcaEntries: DcaEntry[] = []
): PortfolioStats {
  const closed = trades.filter((trade) => trade.status === "closed");
  const open = trades.filter((trade) => trade.status === "open");

  const pnls = closed
    .map((trade) => ({ trade, pnl: computeTradePnL(trade) }))
    .filter((item): item is { trade: Trade; pnl: TradePnL } => item.pnl !== null);

  const wins = pnls.filter((item) => item.pnl.isWin);
  const losses = pnls.filter((item) => !item.pnl.isWin);
  const unrealisedPnls = open
    .map((trade) =>
      trade.currentPrice != null ? computeUnrealisedPnL(trade, trade.currentPrice) : null
    )
    .filter((item): item is TradePnL => item !== null);

  const totalNetPnl = pnls.reduce((sum, item) => sum + item.pnl.net, 0);
  const totalGrossPnl = pnls.reduce((sum, item) => sum + item.pnl.gross, 0);
  const tradeUnrealisedNetPnl = unrealisedPnls.reduce((sum, pnl) => sum + pnl.net, 0);
  const {
    dcaInvested,
    dcaMarketValue,
    dcaRealisedNetPnl,
    dcaUnrealisedNetPnl,
    dcaPositions,
  } = computeDcaUnrealisedPnL(dcaEntries);
  const unrealisedNetPnl = tradeUnrealisedNetPnl + dcaUnrealisedNetPnl;
  const realisedNetPnl = totalNetPnl + dcaRealisedNetPnl;
  const combinedNetPnl = realisedNetPnl + unrealisedNetPnl;
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
    realisedNetPnl,
    unrealisedNetPnl,
    combinedNetPnl,
    totalNetPnl: realisedNetPnl,
    totalGrossPnl,
    tradeRealisedNetPnl: totalNetPnl,
    dcaRealisedNetPnl,
    tradeUnrealisedNetPnl,
    dcaUnrealisedNetPnl,
    dcaMarketValue,
    dcaInvested,
    dcaPositions,
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

function buildDcaRealisedEvents(dcaEntries: DcaEntry[]) {
  const { computedEntries } = buildDcaPositionSummaries(dcaEntries.filter(isDashboardDcaEntry));

  return computedEntries
    .filter((entry) => entry.side === "sell" && entry.realisedPnl != null)
    .map((entry) => ({
      date: entry.investedAt,
      pnl: entry.realisedPnl ?? 0,
    }));
}

export function computeEquityCurve(
  trades: Trade[],
  dcaEntries: DcaEntry[] = [],
  initialCapital = 0
): EquityPoint[] {
  const tradeEvents = trades
    .filter((trade) => trade.status === "closed" && trade.exitDate)
    .map((trade) => ({
      date: trade.exitDate!,
      pnl: computeTradePnL(trade)?.net ?? 0,
    }));
  const dcaEvents = buildDcaRealisedEvents(dcaEntries);
  const events = [...tradeEvents, ...dcaEvents].sort((a, b) => a.date.localeCompare(b.date));

  let cumPnl = 0;
  const points: EquityPoint[] = [];

  for (const event of events) {
    cumPnl += event.pnl;
    points.push({
      date: event.date,
      cumPnl: Math.round(cumPnl * 100) / 100,
      nav: Math.round((initialCapital + cumPnl) * 100) / 100,
      trades: points.length + 1,
    });
  }

  return points;
}

export function computeMonthlyPnl(trades: Trade[], dcaEntries: DcaEntry[] = []): MonthlyPnl[] {
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

  for (const event of buildDcaRealisedEvents(dcaEntries)) {
    const month = event.date.slice(0, 7);
    const existing = map.get(month) ?? { pnl: 0, trades: 0 };

    map.set(month, {
      pnl: existing.pnl + event.pnl,
      trades: existing.trades + 1,
    });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { pnl, trades }]) => {
      const [year, mo] = month.split("-");
      const label = `${year}-${mo.padStart(2, "0")}`;

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
  initialCapital: number,
  dcaEntries: DcaEntry[] = []
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

  assetLabels.stock = "\u80a1\u7968";
  assetLabels.crypto = "\u865a\u62df\u8d27\u5e01";
  assetLabels.forex = "\u5916\u6c47";
  assetLabels.futures = "\u671f\u8d27";
  assetLabels.option = "\u671f\u6743";
  assetLabels.other = "\u5176\u4ed6";

  let cashValue = initialCapital + realisedPnl;

  for (const trade of openTrades) {
    const marketValue = (trade.currentPrice ?? trade.entryPrice) * trade.quantity;
    const existing = allocationMap.get(trade.assetClass) ?? {
      label: assetLabels[trade.assetClass],
      value: 0,
      count: 0,
    };

    allocationMap.set(trade.assetClass, {
      ...existing,
      value: existing.value + Math.abs(marketValue),
      count: existing.count + 1,
    });

    if (trade.direction === "long") {
      cashValue -= trade.entryPrice * trade.quantity;
    } else {
      cashValue += trade.entryPrice * trade.quantity - Math.abs(marketValue);
    }
  }

  const dashboardDcaEntries = dcaEntries.filter(isDashboardDcaEntry);
  const { positions } = buildDcaPositionSummaries(dashboardDcaEntries);

  for (const position of positions.filter((item) => item.remainingQuantity > 0)) {
    const existing = allocationMap.get(position.assetClass) ?? {
      label: assetLabels[position.assetClass],
      value: 0,
      count: 0,
    };

    allocationMap.set(position.assetClass, {
      ...existing,
      value: existing.value + Math.abs(position.marketValue),
      count: existing.count + 1,
    });
  }

  for (const entry of dashboardDcaEntries) {
    if (getDcaEntrySide(entry) === "sell") {
      cashValue += entry.investedAmount;
    } else {
      cashValue -= entry.investedAmount;
    }
  }

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
    value: Math.round(Math.max(cashValue, 0) * 100) / 100,
    percent: 0,
  });

  const cashRow = rows.find((item) => item.key === "cash");
  if (cashRow) {
    cashRow.label = "\u73b0\u91d1 / \u672c\u4f4d";
  }

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
  const dcaEntries = useDcaEntries((state) => state.entries);
  return useMemo(() => computePortfolioStats(trades, dcaEntries), [dcaEntries, trades]);
}

export function useEquityCurve(): EquityPoint[] {
  const trades = useTrades((state) => state.trades);
  const dcaEntries = useDcaEntries((state) => state.entries);
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);

  return useMemo(
    () => computeEquityCurve(trades, dcaEntries, initialCapital),
    [dcaEntries, initialCapital, trades]
  );
}

export function useMonthlyPnl(): MonthlyPnl[] {
  const trades = useTrades((state) => state.trades);
  const dcaEntries = useDcaEntries((state) => state.entries);
  return useMemo(() => computeMonthlyPnl(trades, dcaEntries), [dcaEntries, trades]);
}

export function useAssetBreakdown(): AssetBreakdown[] {
  const trades = useTrades((state) => state.trades);
  return useMemo(() => computeAssetBreakdown(trades), [trades]);
}

export function usePortfolioAllocation(): PortfolioAllocation[] {
  const trades = useTrades((state) => state.trades);
  const dcaEntries = useDcaEntries((state) => state.entries);
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);

  return useMemo(
    () => computePortfolioAllocation(trades, initialCapital, dcaEntries),
    [dcaEntries, initialCapital, trades]
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
