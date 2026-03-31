import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string;        // e.g. "+18.4%"
  trendSign?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  accent?: boolean;      // draws subtle colored left border
}

export function StatCard({
  label,
  value,
  sub,
  trend,
  trendSign = "neutral",
  icon: Icon,
  iconColor = "text-text-muted",
  accent = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl bg-surface-1 border border-border p-5",
        "shadow-card shadow-inner-sm overflow-hidden",
        accent && trendSign === "positive" && "border-l-2 border-l-profit",
        accent && trendSign === "negative" && "border-l-2 border-l-loss"
      )}
    >
      {/* Subtle background glow for accented card */}
      {accent && trendSign === "positive" && (
        <div className="absolute inset-0 bg-gradient-to-br from-profit/5 to-transparent pointer-events-none" />
      )}
      {accent && trendSign === "negative" && (
        <div className="absolute inset-0 bg-gradient-to-br from-loss/5 to-transparent pointer-events-none" />
      )}

      <div className="relative flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </p>
        <div className={cn("p-1.5 rounded-lg bg-surface-3", iconColor)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <p className="relative text-2xl font-semibold text-text-primary tabular-nums tracking-tight leading-none">
        {value}
      </p>

      {(trend || sub) && (
        <div className="relative flex items-center gap-2 mt-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                trendSign === "positive" && "text-profit",
                trendSign === "negative" && "text-loss",
                trendSign === "neutral" && "text-text-muted"
              )}
            >
              {trend}
            </span>
          )}
          {sub && (
            <span className="text-xs text-text-muted truncate">{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}
