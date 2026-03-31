"use client";

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

// ─── Tooltip ─────────────────────────────────────────────────────────────────

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
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 shadow-card text-xs min-w-[140px]">
      <p className="text-text-muted mb-1.5">{label ?? d.label}</p>
      <p
        className={`font-semibold text-sm tabular-nums ${
          isPositive ? "text-profit" : "text-loss"
        }`}
      >
        {isPositive ? "+" : ""}
        {formatCurrency(d.pnl)}
      </p>
      <p className="text-text-muted mt-0.5">
        {d.trades} trade{d.trades !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Axis formatters ─────────────────────────────────────────────────────────

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MonthlyBarChart() {
  const data = useMonthlyPnl();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-text-muted">
        No closed trades yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke="#2a2a2a"
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          tick={{ fill: "#6b6b6b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: "#6b6b6b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />

        <ReferenceLine y={0} stroke="#3a3a3a" strokeWidth={1} />

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
