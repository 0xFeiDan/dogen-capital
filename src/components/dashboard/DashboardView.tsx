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

const CAPITAL_LABEL = "\u672c\u91d1";
const SAVE_LABEL = "\u4fdd\u5b58";
const SAVING_LABEL = "\u4fdd\u5b58\u4e2d...";
const CANCEL_LABEL = "\u53d6\u6d88";
const EDIT_LABEL = "\u4fee\u6539";
const CAPITAL_ERROR = "\u8bf7\u8f93\u5165\u5927\u4e8e 0 \u7684\u672c\u91d1";
const CAPITAL_HINT = "\u53ef\u968f\u65f6\u624b\u52a8\u8c03\u6574";
const TOTAL_PNL_LABEL = "\u603b\u76c8\u4e8f";
const UNREALISED_LABEL = "\u672a\u5b9e\u73b0";
const WIN_RATE_LABEL = "\u80dc\u7387";
const OPEN_TRADES_LABEL = "\u6301\u4ed3\u4e2d";
const NO_OPEN_TRADES_LABEL = "\u6682\u65e0\u6301\u4ed3";
const EQUITY_CURVE_LABEL = "\u51c0\u503c\u66f2\u7ebf";
const EQUITY_CURVE_SUB = "\u672c\u91d1 + \u5df2\u5b9e\u73b0\u51c0\u76c8\u4e8f";
const ASSET_ALLOCATION_LABEL = "\u8d44\u4ea7\u5206\u5e03";
const ASSET_ALLOCATION_SUB = "\u5f53\u524d\u6301\u4ed3 + \u73b0\u91d1 / \u672c\u4f4d";
const MONTHLY_PNL_LABEL = "\u6708\u5ea6\u76c8\u4e8f";
const MONTHLY_PNL_SUB =
  "\u7edf\u8ba1\u4ea4\u6613\u5e73\u4ed3 + \u5b9a\u6295\u5356\u51fa\u7684\u5df2\u5b9e\u73b0\u76c8\u4e8f";

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
    stats.combinedNetPnl > 0
      ? "positive"
      : stats.combinedNetPnl < 0
        ? "negative"
        : "neutral";
  const unrealisedPnlSign =
    stats.unrealisedNetPnl > 0
      ? "positive"
      : stats.unrealisedNetPnl < 0
        ? "negative"
        : "neutral";

  const capitalPnlPercent =
    initialCapital > 0 ? (stats.combinedNetPnl / initialCapital) * 100 : 0;
  const openPositionCount = stats.openTrades + stats.dcaPositions;

  useEffect(() => {
    if (!editingCapital) {
      setCapitalInput(String(initialCapital));
      setCapitalError("");
    }
  }, [editingCapital, initialCapital]);

  async function handleSaveCapital() {
    const nextValue = Number(capitalInput.replaceAll(",", "").trim());

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setCapitalError(CAPITAL_ERROR);
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
              {CAPITAL_LABEL}
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
                    {savingCapital ? SAVING_LABEL : SAVE_LABEL}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditingCapital(false)}
                    disabled={savingCapital}
                    iconLeft={<X className="h-3 w-3" />}
                  >
                    {CANCEL_LABEL}
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingCapital(true)}
                  iconLeft={<PencilLine className="h-3 w-3" />}
                >
                  {EDIT_LABEL}
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
                aria-label={CAPITAL_LABEL}
                value={capitalInput}
                onChange={(event) => {
                  setCapitalInput(event.target.value);
                  if (capitalError) {
                    setCapitalError("");
                  }
                }}
                placeholder={CAPITAL_LABEL}
                inputMode="decimal"
                error={capitalError || undefined}
              />
            </div>
          ) : (
            <div className="relative mt-2 flex items-center gap-2">
              <span className="truncate text-xs text-text-muted">{CAPITAL_HINT}</span>
            </div>
          )}
        </div>

        <StatCard
          label={TOTAL_PNL_LABEL}
          value={formatCurrency(stats.combinedNetPnl, "USD", true)}
          trend={capitalPnlPercent !== 0 ? formatPercent(capitalPnlPercent) : undefined}
          trendSign={pnlSign}
          icon={TrendingUp}
          iconColor={pnlSign === "positive" ? "text-profit" : "text-loss"}
          accent
        />

        <StatCard
          label={WIN_RATE_LABEL}
          value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "--"}
          sub={`${stats.closedTrades} \u7b14\u5df2\u5e73\u4ed3`}
          trend={
            stats.closedTrades > 0
              ? `${stats.losingTrades} \u7b14\u4e8f\u635f`
              : undefined
          }
          trendSign="neutral"
          icon={Target}
          iconColor="text-accent"
        />

        <StatCard
          label={OPEN_TRADES_LABEL}
          value={String(openPositionCount)}
          sub={`\u4ea4\u6613 ${stats.openTrades} / \u5b9a\u6295 ${stats.dcaPositions}`}
          trend={
            openPositionCount > 0
              ? `${UNREALISED_LABEL} ${formatCurrency(stats.unrealisedNetPnl, "USD", true)}`
              : NO_OPEN_TRADES_LABEL
          }
          trendSign={openPositionCount > 0 ? unrealisedPnlSign : "neutral"}
          icon={Layers}
          iconColor="text-text-secondary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card noPadding className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <CardTitle>{EQUITY_CURVE_LABEL}</CardTitle>
            <span className="text-xs text-text-muted tabular-nums">
              {EQUITY_CURVE_SUB}
            </span>
          </div>
          <div className="px-2 py-4">
            <EquityChart />
          </div>
        </Card>

        <Card noPadding>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <CardTitle>{ASSET_ALLOCATION_LABEL}</CardTitle>
            <span className="text-xs text-text-muted tabular-nums">
              {ASSET_ALLOCATION_SUB}
            </span>
          </div>
          <div className="px-5 py-4">
            <AssetPieChart />
          </div>
        </Card>
      </div>

      <Card noPadding>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <CardTitle>{MONTHLY_PNL_LABEL}</CardTitle>
          <span className="text-xs text-text-muted tabular-nums">{MONTHLY_PNL_SUB}</span>
        </div>
        <div className="px-2 py-4">
          <MonthlyBarChart />
        </div>
      </Card>
    </div>
  );
}
