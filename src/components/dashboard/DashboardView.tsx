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
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { updateInitialCapitalOnServer } from "@/lib/server-sync-client";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { usePortfolioStats } from "@/store/selectors";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { StatCard } from "./StatCard";

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
    <div className="flex h-52 items-center justify-center">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export function DashboardView() {
  const stats = usePortfolioStats();
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const initialCapital = usePortfolioSettings((state) => state.initialCapital);
  const setInitialCapital = usePortfolioSettings((state) => state.setInitialCapital);
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(initialCapital));
  const [capitalError, setCapitalError] = useState("");
  const [savingCapital, setSavingCapital] = useState(false);

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

  async function handleSaveCapital() {
    const nextValue = Number(capitalInput.replaceAll(",", "").trim());

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setCapitalError("请输入大于 0 的本金");
      return;
    }

    setSavingCapital(true);

    try {
      const setting = await updateInitialCapitalOnServer(activeUserId, nextValue);
      setInitialCapital(setting.initialCapital);
      setEditingCapital(false);
    } catch (error) {
      setCapitalError((error as Error).message);
    } finally {
      setSavingCapital(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-1 p-5 shadow-card shadow-inner-sm">
          <div className="relative mb-3 flex items-start justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              本金
            </p>
            <div className="flex items-center gap-2">
              {editingCapital ? (
                <>
                  <Button
                    variant="profit"
                    size="xs"
                    onClick={handleSaveCapital}
                    disabled={savingCapital}
                    iconLeft={<Check className="h-3 w-3" />}
                  >
                    {savingCapital ? "保存中" : "保存"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditingCapital(false)}
                    disabled={savingCapital}
                    iconLeft={<X className="h-3 w-3" />}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingCapital(true)}
                  iconLeft={<PencilLine className="h-3 w-3" />}
                >
                  修改
                </Button>
              )}

              <div className="rounded-lg bg-surface-3 p-1.5 text-accent">
                <Wallet className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <p className="relative text-2xl font-semibold leading-none tracking-tight text-text-primary tabular-nums">
            {formatCurrency(initialCapital, "USD", true)}
          </p>

          {editingCapital ? (
            <div className="mt-3 space-y-2">
              <Input
                aria-label="本金"
                value={capitalInput}
                onChange={(event) => {
                  setCapitalInput(event.target.value);
                  if (capitalError) {
                    setCapitalError("");
                  }
                }}
                placeholder="输入本金"
                inputMode="decimal"
                error={capitalError || undefined}
              />
            </div>
          ) : (
            <div className="relative mt-2 flex items-center gap-2">
              <span className="truncate text-xs text-text-muted">可随时自定义或修改</span>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card noPadding className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <CardTitle>净值曲线</CardTitle>
            <span className="text-xs text-text-muted tabular-nums">本金 + 累计净盈亏</span>
          </div>
          <div className="px-2 py-4">
            <EquityChart />
          </div>
        </Card>

        <Card noPadding>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
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
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
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
