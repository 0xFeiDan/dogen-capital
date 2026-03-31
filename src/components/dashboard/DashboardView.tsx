"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Check,
  Layers,
  PencilLine,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { usePortfolioStats } from "@/store/selectors";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { StatCard } from "./StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatPercent } from "@/lib/utils";

const EquityChart = dynamic(() => import("./EquityChart"), {
  ssr: false,
  loading: () => <ChartLoader />,
});
const MonthlyBarChart = dynamic(() => import("./MonthlyBarChart"), {
  ssr: false,
  loading: () => <ChartLoader />,
});
const AssetPieChart = dynamic(() => import("./AssetPieChart"), {
  ssr: false,
  loading: () => <ChartLoader />,
});

function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-52">
      <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

export function DashboardView() {
  const stats = usePortfolioStats();
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);
  const setInitialCapital = usePortfolioSettings((state) => state.setInitialCapital);
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(initialCapital));
  const [capitalError, setCapitalError] = useState("");

  const pnlSign =
    stats.totalNetPnl > 0
      ? "positive"
      : stats.totalNetPnl < 0
        ? "negative"
        : "neutral";

  const capitalPnlPercent =
    initialCapital > 0 ? (stats.totalNetPnl / initialCapital) * 100 : 0;

  useEffect(() => {
    if (!editingCapital) {
      setCapitalInput(String(initialCapital));
      setCapitalError("");
    }
  }, [editingCapital, initialCapital]);

  function handleSaveCapital() {
    const nextValue = Number(capitalInput.replaceAll(",", "").trim());

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setCapitalError("请输入大于 0 的本金");
      return;
    }

    setInitialCapital(nextValue);
    setEditingCapital(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="relative rounded-xl bg-surface-1 border border-border p-5 shadow-card shadow-inner-sm overflow-hidden">
          <div className="relative flex items-start justify-between mb-3 gap-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              本金
            </p>
            <div className="flex items-center gap-2">
              {editingCapital ? (
                <>
                  <Button
                    variant="profit"
                    size="xs"
                    onClick={handleSaveCapital}
                    iconLeft={<Check className="w-3 h-3" />}
                  >
                    保存
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditingCapital(false)}
                    iconLeft={<X className="w-3 h-3" />}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingCapital(true)}
                  iconLeft={<PencilLine className="w-3 h-3" />}
                >
                  修改
                </Button>
              )}
              <div className="p-1.5 rounded-lg bg-surface-3 text-accent">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <p className="relative text-2xl font-semibold text-text-primary tabular-nums tracking-tight leading-none">
            {formatCurrency(initialCapital, "USD", true)}
          </p>

          {editingCapital ? (
            <div className="mt-3 space-y-2">
              <Input
                aria-label="本金"
                value={capitalInput}
                onChange={(event) => {
                  setCapitalInput(event.target.value);
                  if (capitalError) setCapitalError("");
                }}
                placeholder="输入本金"
                inputMode="decimal"
                error={capitalError || undefined}
              />
            </div>
          ) : (
            <div className="relative flex items-center gap-2 mt-2">
              <span className="text-xs text-text-muted truncate">
                可随时自定义或修改
              </span>
            </div>
          )}
        </div>

        <StatCard
          label="净盈亏"
          value={formatCurrency(stats.totalNetPnl, "USD", true)}
          trend={capitalPnlPercent !== 0 ? formatPercent(capitalPnlPercent) : undefined}
          trendSign={pnlSign}
          sub="基于已平仓交易"
          icon={TrendingUp}
          iconColor={pnlSign === "positive" ? "text-profit" : "text-loss"}
          accent
        />

        <StatCard
          label="胜率"
          value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "--"}
          sub={`${stats.closedTrades} 笔已平仓`}
          trend={
            stats.closedTrades > 0
              ? `${stats.closedTrades - Math.round(stats.closedTrades * (stats.winRate / 100))} 笔亏损`
              : undefined
          }
          trendSign="neutral"
          icon={Target}
          iconColor="text-accent"
        />

        <StatCard
          label="持仓中"
          value={String(stats.openTrades)}
          sub={`共 ${stats.totalTrades} 笔交易`}
          trend={stats.openTrades > 0 ? `${stats.openTrades} 笔进行中` : "暂无持仓"}
          trendSign="neutral"
          icon={Layers}
          iconColor="text-text-secondary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card noPadding className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <CardTitle>净值曲线</CardTitle>
            <span className="text-xs text-text-muted tabular-nums">
              本金 + 累计净盈亏
            </span>
          </div>
          <div className="px-2 py-4">
            <EquityChart />
          </div>
        </Card>

        <Card noPadding>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <CardTitle>资产分布</CardTitle>
            <span className="text-xs text-text-muted tabular-nums">
              当前持仓 + 现金 / 本位
            </span>
          </div>
          <div className="px-5 py-4">
            <AssetPieChart />
          </div>
        </Card>
      </div>

      <Card noPadding>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <CardTitle>月度盈亏</CardTitle>
          <span className="text-xs text-text-muted tabular-nums">
            已平仓净盈亏，按出场月份
          </span>
        </div>
        <div className="px-2 py-4">
          <MonthlyBarChart />
        </div>
      </Card>
    </div>
  );
}
