"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  EMPTY_THOUGHT_FORM,
  ThoughtForm,
  formToThought,
  thoughtToForm,
} from "./ThoughtForm";
import type { ThoughtFormState } from "./ThoughtForm";
import { useThoughts } from "@/store/useThoughts";
import type { Thought, ThoughtCategory } from "@/types";

const CATEGORY_STYLES: Record<ThoughtCategory, string> = {
  macro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sector: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  stock: "bg-accent/10 text-accent border-accent/20",
  strategy: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  review: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  other: "bg-surface-3 text-text-muted border-border",
};

const CATEGORY_LABELS: Record<ThoughtCategory, string> = {
  macro: "宏观",
  sector: "行业",
  stock: "个股",
  strategy: "策略",
  review: "复盘",
  other: "其他",
};

type DrawerMode = "view" | "edit";

interface ThoughtDrawerProps {
  open: boolean;
  onClose: () => void;
  thought?: Thought | null;
  initialMode?: DrawerMode;
}

function ThoughtView({
  thought,
  onEdit,
}: {
  thought: Thought;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
              CATEGORY_STYLES[thought.category]
            )}
          >
            {CATEGORY_LABELS[thought.category]}
          </span>
          {thought.ticker && (
            <Badge variant="outline" className="font-mono">
              ${thought.ticker}
            </Badge>
          )}
          {thought.isPrivate && <Badge variant="default">私密</Badge>}
        </div>

        <h1 className="text-xl font-bold text-text-primary leading-snug mb-3">
          {thought.title}
        </h1>

        <p className="text-xs text-text-muted mb-5">
          创建于 {formatDate(thought.createdAt)}
          {thought.updatedAt !== thought.createdAt && (
            <span> · 更新于 {formatDate(thought.updatedAt)}</span>
          )}
        </p>

        <MarkdownRenderer content={thought.content} />

        {thought.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-border">
            {thought.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface-1">
        <Button
          variant="secondary"
          iconLeft={<Pencil className="w-3.5 h-3.5" />}
          onClick={onEdit}
        >
          编辑
        </Button>
      </div>
    </div>
  );
}

export function ThoughtDrawer({
  open,
  onClose,
  thought,
  initialMode = "edit",
}: ThoughtDrawerProps) {
  const { addThought, updateThought } = useThoughts();
  const [mode, setMode] = useState<DrawerMode>(() =>
    !thought ? "edit" : initialMode
  );

  useEffect(() => {
    setMode(!thought ? "edit" : initialMode);
  }, [thought, initialMode]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleSubmit(data: ThoughtFormState) {
    const thoughtData = formToThought(data);

    if (thought) {
      updateThought(thought.id, thoughtData);
    } else {
      addThought(thoughtData);
    }

    onClose();
  }

  const isEditing = !!thought;
  const title = !thought ? "新建笔记" : mode === "view" ? "查看笔记" : "编辑笔记";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 z-40 h-full w-full sm:w-[720px]",
          "bg-surface-1 border-l border-border flex flex-col",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            {isEditing && (
              <div className="flex rounded-md bg-surface-2 border border-border p-0.5">
                <button
                  onClick={() => setMode("view")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    mode === "view"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  查看
                </button>
                <button
                  onClick={() => setMode("edit")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    mode === "edit"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  编辑
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {open &&
          (mode === "view" && thought ? (
            <ThoughtView thought={thought} onEdit={() => setMode("edit")} />
          ) : (
            <ThoughtForm
              key={thought?.id ?? "new"}
              initialValues={thought ? thoughtToForm(thought) : EMPTY_THOUGHT_FORM}
              onSubmit={handleSubmit}
              onCancel={onClose}
              submitLabel={isEditing ? "保存修改" : "创建笔记"}
            />
          ))}
      </div>
    </>
  );
}
