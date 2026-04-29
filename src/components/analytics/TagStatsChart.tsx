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
import { useTagStats } from "@/store/selectors";
import { formatCurrency } from "@/lib/utils";
import type { TagStats } from "@/types";

const GRID_COLOR = "var(--chart-grid)";
const TICK_COLOR = "var(--chart-tick)";
const CURSOR_COLOR = "var(--chart-cursor)";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TagStats }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 shadow-card text-xs min-w-[160px]">
      <p className="font-semibold text-text-primary mb-1.5">#{d.tag}</p>
      <p className="text-text-secondary">
        Win Rate:{" "}
        <span
          className={
            d.winRate >= 50 ? "text-profit font-medium" : "text-loss font-medium"
          }
        >
          {d.winRate.toFixed(1)}%
        </span>
      </p>
      <p className="text-text-muted mt-0.5">
        {d.wins}W / {d.losses}L · {d.total} trade{d.total !== 1 ? "s" : ""}
      </p>
      <p
        className={`mt-1 font-medium tabular-nums ${
          d.totalPnl >= 0 ? "text-profit" : "text-loss"
        }`}
      >
        {d.totalPnl >= 0 ? "+" : ""}
        {formatCurrency(d.totalPnl)} total
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TagStatsChart() {
  const raw = useTagStats();
  // Top 8 by totalPnl (already sorted), reverse so best appears at top
  const data = [...raw.slice(0, 8)].reverse();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-text-muted">
        No tagged closed trades yet
      </div>
    );
  }

  const height = Math.max(180, data.length * 38);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
      >
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />

        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          type="category"
          dataKey="tag"
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
          tickFormatter={(v) => `#${v}`}
        />

        <ReferenceLine
          x={50}
          stroke={GRID_COLOR}
          strokeDasharray="4 2"
          strokeWidth={1}
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: CURSOR_COLOR }}
        />

        <Bar dataKey="winRate" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.winRate >= 50 ? "#22c55e" : "#ef4444"}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
