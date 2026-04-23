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
import { formatCurrency } from "@/lib/utils";
import type { MonthlyPnl } from "@/types";

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "#2a2a2a",
    tick: "#6b6b6b",
    cursor: "#3a3a3a",
  });

  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    function update() {
      setColors({
        grid: style.getPropertyValue("--chart-grid").trim() || "#2a2a2a",
        tick: style.getPropertyValue("--chart-tick").trim() || "#6b6b6b",
        cursor: style.getPropertyValue("--chart-cursor").trim() || "#3a3a3a",
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
      <p className="mt-0.5 text-text-muted">{d.trades} \u6761\u5df2\u5b9e\u73b0\u8bb0\u5f55</p>
    </div>
  );
}

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MonthlyBarChart() {
  const data = useMonthlyPnl();
  const chartColors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-text-muted">
        \u6682\u65e0\u5df2\u5b9e\u73b0\u76c8\u4e8f\u8bb0\u5f55
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
              fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
