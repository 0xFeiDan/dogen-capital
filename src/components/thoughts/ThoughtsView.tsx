"use client";

import { useMemo, useState } from "react";
import { Brain, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ThoughtCard } from "./ThoughtCard";
import { ThoughtDrawer } from "./ThoughtDrawer";
import { ThoughtFilters, DEFAULT_THOUGHT_FILTERS } from "./ThoughtFilters";
import { useThoughts } from "@/store/useThoughts";
import type { Thought } from "@/types";
import type { ThoughtFiltersState, ThoughtSort } from "./ThoughtFilters";

function applyFilters(thoughts: Thought[], filters: ThoughtFiltersState): Thought[] {
  const query = filters.search.toLowerCase();

  return thoughts.filter((thought) => {
    if (!filters.showPrivate && thought.isPrivate) return false;
    if (filters.category !== "all" && thought.category !== filters.category) {
      return false;
    }
    if (filters.tags.length > 0 && !filters.tags.some((tag) => thought.tags.includes(tag))) {
      return false;
    }
    if (
      query &&
      !thought.title.toLowerCase().includes(query) &&
      !thought.content.toLowerCase().includes(query) &&
      !thought.tags.some((tag) => tag.toLowerCase().includes(query)) &&
      !thought.ticker?.toLowerCase().includes(query)
    ) {
      return false;
    }

    return true;
  });
}

function applySort(thoughts: Thought[], sort: ThoughtSort): Thought[] {
  return [...thoughts].sort((a, b) => {
    switch (sort) {
      case "newest":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "oldest":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "title":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-surface-2 border border-border">
        <Brain className="w-6 h-6 text-text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-secondary">
          {hasFilters ? "没有符合筛选条件的笔记" : "暂无思考笔记"}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {hasFilters ? "试试调整搜索、分类或自定义标签筛选。" : "记录你的市场分析和交易思考。"}
        </p>
      </div>
    </div>
  );
}

export function ThoughtsView() {
  const { thoughts, deleteThought } = useThoughts();

  const [filters, setFilters] = useState<ThoughtFiltersState>(DEFAULT_THOUGHT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("edit");
  const [deleteTarget, setDeleteTarget] = useState<Thought | null>(null);

  const filtered = useMemo(() => applyFilters(thoughts, filters), [thoughts, filters]);
  const sorted = useMemo(
    () => applySort(filtered, filters.sort),
    [filtered, filters.sort]
  );

  function handleOpenThought(thought: Thought) {
    setSelectedThought(thought);
    setDrawerMode("view");
    setDrawerOpen(true);
  }

  function handleEditThought(thought: Thought) {
    setSelectedThought(thought);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  function handleNewThought() {
    setSelectedThought(null);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setSelectedThought(null);
  }

  const isFiltered =
    filters.search !== "" ||
    filters.category !== "all" ||
    filters.tags.length > 0 ||
    !filters.showPrivate;

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <ThoughtFilters
            filters={filters}
            onChange={setFilters}
            totalCount={thoughts.length}
            filteredCount={filtered.length}
          />
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={handleNewThought}
            className="shrink-0"
          >
            新建笔记
          </Button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState hasFilters={isFiltered} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((thought) => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                onOpen={handleOpenThought}
                onEdit={handleEditThought}
                onDelete={(item) => setDeleteTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ThoughtDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        thought={selectedThought}
        initialMode={drawerMode}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="删除这条笔记？"
        description={
          deleteTarget ? `"${deleteTarget.title}" 将从思考笔记中永久删除。` : undefined
        }
        confirmLabel="删除"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            deleteThought(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}
