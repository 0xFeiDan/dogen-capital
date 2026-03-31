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
  ReferenceLine,
} from "recharts";
import { useEquityCurve } from "@/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EquityPoint } from "@/types";

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "#2a2a2a",
    tick: "#6b6b6b",
    cursor: "#3a3a3a",
    dotBg: "#111111",
  });

  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    function update() {
      setColors({
        grid: style.getPropertyValue("--chart-grid").trim() || "#2a2a2a",
        tick: style.getPropertyValue("--chart-tick").trim() || "#6b6b6b",
        cursor: style.getPropertyValue("--chart-cursor").trim() || "#3a3a3a",
        dotBg: style.getPropertyValue("--chart-dot-bg").trim() || "#111111",
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
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 shadow-card text-xs min-w-[160px]">
      <p className="text-text-muted mb-1.5">{formatDate(d.date)}</p>
      <p className="font-semibold text-sm tabular-nums text-text-primary">
        {formatCurrency(d.nav)}
      </p>
      <p className="text-text-muted mt-0.5">
        累计净盈亏{" "}
        <span className={isPositive ? "text-profit" : "text-loss"}>
          {isPositive ? "+" : ""}
          {formatCurrency(d.cumPnl)}
        </span>
      </p>
      <p className="text-text-muted mt-0.5">{d.trades} 笔已平仓</p>
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
      <div className="flex items-center justify-center h-52 text-sm text-text-muted">
        暂无已平仓交易
      </div>
    );
  }

  const principalLine = data[0].nav - data[0].cumPnl;
  const lastPoint = data[data.length - 1];
  const gradientId = lastPoint.cumPnl >= 0 ? "equityGreen" : "equityRed";
  const lineColor = lastPoint.cumPnl >= 0 ? "#22c55e" : "#ef4444";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="equityRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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

        <ReferenceLine
          y={principalLine}
          stroke={chartColors.cursor}
          strokeDasharray="4 2"
          strokeWidth={1}
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: chartColors.cursor, strokeWidth: 1 }}
        />

        <Area
          type="monotone"
          dataKey="nav"
          stroke={lineColor}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
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
