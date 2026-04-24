"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEquityCurve } from "@/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EquityPoint } from "@/types";

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "#d6cab8",
    tick: "#8e7e65",
    cursor: "#c0b09a",
    dotBg: "#fcf8f1",
    accent: "#bf884a",
    profit: "#22965e",
    loss: "#c3513a",
  });

  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    function readRgbVar(name: string, fallback: string) {
      const value = style.getPropertyValue(name).trim();
      return value ? `rgb(${value})` : fallback;
    }

    function update() {
      setColors({
        grid: style.getPropertyValue("--chart-grid").trim() || "#d6cab8",
        tick: style.getPropertyValue("--chart-tick").trim() || "#8e7e65",
        cursor: style.getPropertyValue("--chart-cursor").trim() || "#c0b09a",
        dotBg: style.getPropertyValue("--chart-dot-bg").trim() || "#fcf8f1",
        accent: readRgbVar("--accent", "#bf884a"),
        profit: readRgbVar("--profit", "#22965e"),
        loss: readRgbVar("--loss", "#c3513a"),
      });
    }

    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EquityPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;
  const isPositive = d.cumPnl >= 0;

  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs shadow-card">
      <p className="mb-1.5 text-text-muted">{formatDate(d.date)}</p>
      <p className="text-sm font-semibold tabular-nums text-text-primary">
        {formatCurrency(d.nav)}
      </p>
      <p className="mt-0.5 text-text-muted">
        累计已实现{" "}
        <span className={isPositive ? "text-profit" : "text-loss"}>
          {isPositive ? "+" : ""}
          {formatCurrency(d.cumPnl)}
        </span>
      </p>
      <p className="mt-0.5 text-text-muted">{d.trades} 条已实现记录</p>
    </div>
  );
}

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

function formatXAxis(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function EquityChart() {
  const data = useEquityCurve();
  const chartColors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-text-muted">
        暂无已实现盈亏记录
      </div>
    );
  }

  const lineColor = chartColors.accent;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityNeutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.08} />
            <stop offset="95%" stopColor={chartColors.accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke={chartColors.grid}
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="date"
          tickFormatter={formatXAxis}
          tick={{ fill: chartColors.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: chartColors.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: chartColors.cursor, strokeWidth: 1 }}
        />

        <Area
          type="monotone"
          dataKey="nav"
          stroke={lineColor}
          strokeWidth={1.2}
          fill="url(#equityNeutral)"
          dot={false}
          activeDot={{
            r: 4,
            fill: lineColor,
            stroke: chartColors.dotBg,
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
