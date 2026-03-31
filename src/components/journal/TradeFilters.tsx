"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { AssetClass } from "@/types";

export type HoldingDurationFilter =
  | "all"
  | "lt1h"
  | "h1to24"
  | "d1to3"
  | "d3to7"
  | "gt7d";

export interface JournalFilters {
  search: string;
  status: "all" | "open" | "closed";
  direction: "all" | "long" | "short";
  assetClass: AssetClass | "all";
  pnl: "all" | "win" | "loss";
  holdingDuration: HoldingDurationFilter;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: JournalFilters = {
  search: "",
  status: "all",
  direction: "all",
  assetClass: "all",
  pnl: "all",
  holdingDuration: "all",
  dateFrom: "",
  dateTo: "",
};

interface TradeFiltersProps {
  filters: JournalFilters;
  onChange: (filters: JournalFilters) => void;
  totalCount: number;
  filteredCount: number;
}

function TabFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-surface-2/80 border border-border p-0.5 h-9 shrink-0">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3.5 rounded-lg text-xs font-medium transition-all duration-150",
            value === option.value
              ? "bg-surface-4 text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TradeFilters({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: TradeFiltersProps) {
  const set =
    <K extends keyof JournalFilters>(key: K) =>
    (value: JournalFilters[K]) =>
      onChange({ ...filters, [key]: value });

  const activeCount = [
    filters.status !== "all",
    filters.direction !== "all",
    filters.assetClass !== "all",
    filters.pnl !== "all",
    filters.holdingDuration !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  const isFiltered = filters.search !== "" || activeCount > 0;

  return (
    <div className="space-y-3 flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <Input
            placeholder="搜索代码、名称、标签"
            value={filters.search}
            onChange={(event) => set("search")(event.target.value)}
            iconLeft={<SlidersHorizontal className="w-3.5 h-3.5" />}
            className="h-9 text-xs"
          />
        </div>

        <TabFilter
          value={filters.status}
          onChange={set("status")}
          options={[
            { value: "all", label: "全部" },
            { value: "open", label: "持仓中" },
            { value: "closed", label: "已平仓" },
          ]}
        />

        <TabFilter
          value={filters.direction}
          onChange={set("direction")}
          options={[
            { value: "all", label: "全部" },
            { value: "long", label: "做多" },
            { value: "short", label: "做空" },
          ]}
        />

        <TabFilter
          value={filters.pnl}
          onChange={set("pnl")}
          options={[
            { value: "all", label: "全部" },
            { value: "win", label: "盈利" },
            { value: "loss", label: "亏损" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.assetClass}
          onChange={set("assetClass") as (value: string) => void}
          options={[
            { value: "all", label: "全部资产" },
            { value: "stock", label: "股票" },
            { value: "etf", label: "ETF" },
            { value: "crypto", label: "加密货币" },
            { value: "forex", label: "外汇" },
            { value: "futures", label: "期货" },
            { value: "option", label: "期权" },
            { value: "other", label: "其他" },
          ]}
          className="h-9 text-xs w-36"
        />

        <Select
          value={filters.holdingDuration}
          onChange={set("holdingDuration") as (value: string) => void}
          options={[
            { value: "all", label: "全部持仓时长" },
            { value: "lt1h", label: "1小时内" },
            { value: "h1to24", label: "1 - 24小时" },
            { value: "d1to3", label: "1 - 3 Day" },
            { value: "d3to7", label: "3 - 7 Day" },
            { value: "gt7d", label: "7天以上" },
          ]}
          className="h-9 text-xs w-40"
        />

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => set("dateFrom")(event.target.value)}
            className="h-9 text-xs w-36"
          />
          <span className="text-text-muted text-xs">至</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) => set("dateTo")(event.target.value)}
            className="h-9 text-xs w-36"
          />
        </div>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<X className="w-3 h-3" />}
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-text-muted h-9 text-xs"
          >
            清除
          </Button>
        )}

        <span className="ml-auto text-xs text-text-muted tabular-nums">
          {filteredCount === totalCount
            ? `${totalCount} 笔交易`
            : `共 ${totalCount} 笔，当前 ${filteredCount} 笔`}
        </span>
      </div>
    </div>
  );
}
