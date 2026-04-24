"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { usePortfolioAllocation } from "@/store/selectors";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioAllocation } from "@/types";

const SLICE_COLORS: Record<string, string> = {
  stock: "#c78a4c",
  etf: "#5b8def",
  crypto: "#f59e0b",
  forex: "#14b8a6",
  futures: "#7c83fd",
  option: "#ef5da8",
  other: "#94a3b8",
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PortfolioAllocation }>;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 shadow-card text-xs min-w-[160px]">
      <p className="font-medium text-text-primary mb-1">{item.label}</p>
      <p className="text-text-secondary tabular-nums">{formatCurrency(item.value)}</p>
      <p className="text-text-muted mt-1">{item.percent.toFixed(1)}%</p>
      {typeof item.count === "number" && (
        <p className="text-text-muted mt-0.5">{item.count} 笔持仓</p>
      )}
    </div>
  );
}

function Legend({ data }: { data: PortfolioAllocation[] }) {
  return (
    <div className="space-y-2.5 mt-4">
      {data.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: SLICE_COLORS[item.key] ?? "#94a3b8" }}
            />
            <span className="text-xs text-text-secondary truncate">{item.label}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-text-secondary tabular-nums">
              {item.percent.toFixed(0)}%
            </p>
            <p className="text-2xs text-text-muted tabular-nums">
              {formatCurrency(item.value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssetPieChart() {
  const allocation = usePortfolioAllocation();

  if (allocation.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-text-muted">
        暂无资产分布数据
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={176}>
        <PieChart>
          <Pie
            data={allocation}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={76}
            paddingAngle={2}
            strokeWidth={0}
          >
            {allocation.map((item) => (
              <Cell
                key={item.key}
                fill={SLICE_COLORS[item.key] ?? "#94a3b8"}
                opacity={0.92}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <Legend data={allocation} />
    </div>
  );
}
