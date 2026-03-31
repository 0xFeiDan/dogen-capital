"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { cn } from "@/lib/utils";
import { CATEGORY_STYLES } from "./ThoughtCard";
import type { ThoughtCategory } from "@/types";

export type ThoughtSort = "newest" | "oldest" | "title";

export interface ThoughtFiltersState {
  search: string;
  category: ThoughtCategory | "all";
  tags: string[];
  sort: ThoughtSort;
  showPrivate: boolean;
}

export const DEFAULT_THOUGHT_FILTERS: ThoughtFiltersState = {
  search: "",
  category: "all",
  tags: [],
  sort: "newest",
  showPrivate: true,
};

const CATEGORIES: Array<{ value: ThoughtCategory | "all"; label: string }> = [
  { value: "all", label: "全部" },
  { value: "macro", label: "宏观" },
  { value: "sector", label: "行业" },
  { value: "stock", label: "个股" },
  { value: "strategy", label: "策略" },
  { value: "review", label: "复盘" },
  { value: "other", label: "其他" },
];

interface ThoughtFiltersProps {
  filters: ThoughtFiltersState;
  onChange: (filters: ThoughtFiltersState) => void;
  totalCount: number;
  filteredCount: number;
}

export function ThoughtFilters({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: ThoughtFiltersProps) {
  const set =
    <K extends keyof ThoughtFiltersState>(key: K) =>
    (value: ThoughtFiltersState[K]) =>
      onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-3 flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[220px] max-w-md">
          <Input
            placeholder="搜索标题、内容、代码"
            value={filters.search}
            onChange={(event) => set("search")(event.target.value)}
            iconLeft={<Search className="w-3.5 h-3.5" />}
            className="h-9 text-xs"
          />
        </div>

        <Select
          value={filters.sort}
          onChange={set("sort") as (value: string) => void}
          options={[
            { value: "newest", label: "最新优先" },
            { value: "oldest", label: "最旧优先" },
            { value: "title", label: "标题 A-Z" },
          ]}
          className="h-9 text-xs w-36"
        />

        <button
          onClick={() => set("showPrivate")(!filters.showPrivate)}
          className={cn(
            "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors",
            filters.showPrivate
              ? "bg-surface-2 border-border text-text-secondary hover:border-border-strong"
              : "bg-surface-3 border-border-strong text-text-primary"
          )}
        >
          {filters.showPrivate ? "显示私密" : "隐藏私密"}
        </button>

        <span className="ml-auto text-xs text-text-muted tabular-nums">
          {filteredCount === totalCount
            ? `${totalCount} 条笔记`
            : `${totalCount} 条中 ${filteredCount} 条`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(({ value, label }) => {
          const active = filters.category === value;

          return (
            <button
              key={value}
              onClick={() => set("category")(value)}
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active && value !== "all"
                  ? CATEGORY_STYLES[value as ThoughtCategory]
                  : active
                    ? "bg-surface-3 border-border-strong text-text-primary"
                    : "bg-surface-1 border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <TagInput
        label="自定义标签筛选"
        tags={filters.tags}
        onChange={set("tags") as (value: string[]) => void}
        placeholder="输入想筛选的标签，按 Enter 添加"
        hint="可输入多个标签，命中任意一个标签就会显示"
        clearLabel="清空筛选标签"
      />
    </div>
  );
}
