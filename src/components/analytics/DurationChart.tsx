"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useDurationBuckets } from "@/store/selectors";
import type { DurationBucket } from "@/types";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DurationBucket }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 shadow-card text-xs">
      <p className="font-semibold text-text-primary">{d.label}</p>
      <p className="text-text-muted mt-0.5">
        {d.count} trade{d.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Component ─────────────────────────────���─────────────────────────────────

const BAR_COLORS = ["#e8d5a3", "#c8b583", "#a89563", "#887543", "#685523"];
const GRID_COLOR = "var(--chart-grid)";
const TICK_COLOR = "var(--chart-tick)";
const CURSOR_COLOR = "var(--chart-cursor)";

export default function DurationChart() {
  const data = useDurationBuckets();
  const total = data.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-text-muted">
        No closed trades yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={GRID_COLOR}
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          allowDecimals={false}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={24}
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: CURSOR_COLOR }}
        />

        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
