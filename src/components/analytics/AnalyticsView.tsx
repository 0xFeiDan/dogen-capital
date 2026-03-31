"use client";

import dynamic from "next/dynamic";
import { BarChart2, Crosshair, TrendingUp, TrendingDown, Clock, CreditCard } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  usePortfolioStats,
  useAvgHoldingDays,
  useTotalFees,
} from "@/store/selectors";
import { formatCurrency } from "@/lib/utils";
import PerformersTable from "./PerformersTable";

// ─── Dynamic chart imports (SSR disabled for Recharts) ───────────────────────

const ChartSkeleton = ({ h }: { h: number }) => (
  <div className={`animate-pulse bg-surface-2 rounded-lg`} style={{ height: h }} />
);

const EquityChart = dynamic(
  () => import("../dashboard/EquityChart"),
  { ssr: false, loading: () => <ChartSkeleton h={220} /> }
);

const MonthlyBarChart = dynamic(
  () => import("../dashboard/MonthlyBarChart"),
  { ssr: false, loading: () => <ChartSkeleton h={220} /> }
);

const TagStatsChart = dynamic(
  () => import("./TagStatsChart"),
  { ssr: false, loading: () => <ChartSkeleton h={200} /> }
);

const DurationChart = dynamic(
  () => import("./DurationChart"),
  { ssr: false, loading: () => <ChartSkeleton h={180} /> }
);

// ─── Win/Loss breakdown (no Recharts needed) ─────────────────────────────────

function WinLossSummary({
  winRate,
  closedTrades,
}: {
  winRate: number;
  closedTrades: number;
}) {
  const wins = Math.round((winRate / 100) * closedTrades);
  const losses = closedTrades - wins;
  const color = winRate >= 50 ? "#22c55e" : "#ef4444";

  return (
    <div className="space-y-5 py-2">
      <div className="text-center">
        <p
          className="text-4xl font-bold tabular-nums tracking-tight"
          style={{ color }}
        >
          {winRate.toFixed(1)}%
        </p>
        <p className="text-xs text-text-muted mt-1">胜率</p>
      </div>

      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden bg-surface-3 flex">
        <div
          className="h-full bg-profit transition-all duration-500"
          style={{ width: `${winRate}%` }}
        />
        <div className="h-full flex-1 bg-loss/50" />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-profit font-medium">{wins} 盈</span>
        <span className="text-text-muted">{closedTrades} 已平仓</span>
        <span className="text-loss font-medium">{losses} 亏</span>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const stats = usePortfolioStats();
  const avgHold = useAvgHoldingDays();
  const totalFees = useTotalFees();

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="盈利因子"
          value={
            stats.profitFactor === Infinity
              ? "∞"
              : stats.profitFactor.toFixed(2)
          }
          sub="总盈 / 总亏"
          icon={BarChart2}
          trendSign={
            stats.profitFactor >= 1.5
              ? "positive"
              : stats.profitFactor < 1
              ? "negative"
              : "neutral"
          }
        />
        <StatCard
          label="期望值"
          value={formatCurrency(stats.expectancy, "USD", true)}
          sub="每笔平均净盈亏"
          icon={Crosshair}
          trendSign={
            stats.expectancy > 0
              ? "positive"
              : stats.expectancy < 0
              ? "negative"
              : "neutral"
          }
        />
        <StatCard
          label="平均盈利"
          value={formatCurrency(stats.avgWin, "USD", true)}
          sub="每笔盈利交易"
          icon={TrendingUp}
          iconColor="text-profit"
          trendSign="positive"
        />
        <StatCard
          label="平均亏损"
          value={formatCurrency(stats.avgLoss, "USD", true)}
          sub="每笔亏损交易"
          icon={TrendingDown}
          iconColor="text-loss"
          trendSign="negative"
        />
        <StatCard
          label="平均持仓"
          value={avgHold === 0 ? "—" : `${avgHold}天`}
          sub="每笔已平仓交易"
          icon={Clock}
          trendSign="neutral"
        />
        <StatCard
          label="总手续费"
          value={formatCurrency(totalFees, "USD", true)}
          sub="全部交易合计"
          icon={CreditCard}
          trendSign={totalFees > 0 ? "negative" : "neutral"}
        />
      </div>

      {/* ── Row 2: Equity curve + Monthly PnL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" noPadding>
          <div className="p-5 border-b border-border">
            <CardTitle>组合净值曲线</CardTitle>
          </div>
          <div className="p-5">
            <EquityChart />
          </div>
        </Card>

        <Card noPadding>
          <div className="p-5 border-b border-border">
            <CardTitle>月度盈亏</CardTitle>
          </div>
          <div className="p-5">
            <MonthlyBarChart />
          </div>
        </Card>
      </div>

      {/* ── Row 3: Tag win rate + Duration + Win/Loss ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card noPadding>
          <div className="p-5 border-b border-border">
            <CardTitle>按标签胜率</CardTitle>
          </div>
          <div className="p-5">
            <TagStatsChart />
          </div>
        </Card>

        <Card noPadding>
          <div className="p-5 border-b border-border">
            <CardTitle>持仓时长分布</CardTitle>
          </div>
          <div className="p-5">
            <DurationChart />
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-5">盈亏分布</CardTitle>
          {stats.closedTrades > 0 ? (
            <WinLossSummary
              winRate={stats.winRate}
              closedTrades={stats.closedTrades}
            />
          ) : (
            <div className="flex items-center justify-center h-28 text-sm text-text-muted">
              暂无已平仓交易
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Best / Worst performers ── */}
      <Card noPadding>
        <div className="p-5 border-b border-border">
          <CardTitle>交易排行榜</CardTitle>
        </div>
        <div className="p-5">
          <PerformersTable />
        </div>
      </Card>
    </div>
  );
}
