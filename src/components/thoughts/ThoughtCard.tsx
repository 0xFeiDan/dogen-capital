"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";
import type { Thought, ThoughtCategory } from "@/types";

export const CATEGORY_STYLES: Record<ThoughtCategory, string> = {
  macro: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  sector: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  stock: "bg-accent/10 text-accent border-accent/20",
  strategy: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  review: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  other: "bg-surface-3 text-text-muted border-border",
};

export const CATEGORY_LABELS: Record<ThoughtCategory, string> = {
  macro: "宏观",
  sector: "行业",
  stock: "个股",
  strategy: "策略",
  review: "复盘",
  other: "其他",
};

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/>\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

interface ThoughtCardProps {
  thought: Thought;
  onOpen: (thought: Thought) => void;
  onEdit: (thought: Thought) => void;
  onDelete: (thought: Thought) => void;
}

export function ThoughtCard({
  thought,
  onOpen,
  onEdit,
  onDelete,
}: ThoughtCardProps) {
  const plainText = stripMarkdown(thought.content);
  const excerpt = plainText.slice(0, 200);
  const visibleTags = thought.tags.slice(0, 3);
  const hiddenTagCount = thought.tags.length - visibleTags.length;

  return (
    <div
      className={cn(
        "group relative rounded-xl bg-surface-1 border border-border",
        "shadow-card shadow-inner-sm",
        "flex flex-col gap-3 p-5 cursor-pointer",
        "hover:border-border-strong hover:bg-surface-2/60 transition-colors duration-150"
      )}
      onClick={() => onOpen(thought)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
              CATEGORY_STYLES[thought.category]
            )}
          >
            {CATEGORY_LABELS[thought.category]}
          </span>
          {thought.isPrivate && <Lock className="w-3 h-3 text-text-muted" />}
        </div>

        <div
          className="flex items-center gap-1 opacity-100 transition-opacity shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => onEdit(thought)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-surface-3 transition-colors"
            aria-label="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(thought)}
            className="p-1.5 rounded-md text-text-muted hover:text-loss hover:bg-surface-3 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
        {thought.title}
      </h3>

      {excerpt && (
        <p className="text-xs text-text-muted leading-relaxed line-clamp-3 flex-1">
          {excerpt}
          {plainText.length > 200 && "..."}
        </p>
      )}

      {thought.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-2xs">
              #{tag}
            </Badge>
          ))}
          {hiddenTagCount > 0 && (
            <Badge variant="default" className="text-2xs">
              +{hiddenTagCount}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        {thought.ticker ? (
          <span className="font-mono text-xs text-accent">${thought.ticker}</span>
        ) : (
          <span />
        )}
        <span className="text-2xs text-text-muted">{formatDate(thought.updatedAt)}</span>
      </div>
    </div>
  );
}
