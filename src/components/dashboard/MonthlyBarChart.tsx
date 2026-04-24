"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useMonthlyPnl } from "@/store/selectors";
import { cn, formatCurrency } from "@/lib/utils";
import type { MonthlyPnl } from "@/types";

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "#d6cab8",
    tick: "#8e7e65",
    cursor: "#c0b09a",
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
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyPnl }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isPositive = d.pnl >= 0;

  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs shadow-card">
      <p className="mb-1.5 text-text-muted">{label ?? d.label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          isPositive ? "text-profit" : "text-loss"
        )}
      >
        {isPositive ? "+" : ""}
        {formatCurrency(d.pnl)}
      </p>
      <p className="mt-0.5 text-text-muted">{d.trades} 条已实现记录</p>
    </div>
  );
}

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

export default function MonthlyBarChart() {
  const data = useMonthlyPnl();
  const chartColors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-text-muted">
        暂无已实现盈亏记录
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={chartColors.grid}
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          tick={{ fill: chartColors.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: chartColors.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />

        <ReferenceLine y={0} stroke={chartColors.cursor} strokeWidth={1} />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />

        <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.pnl >= 0 ? chartColors.profit : chartColors.loss}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
