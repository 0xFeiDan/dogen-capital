"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateThoughtOnServer, saveThoughtToServer, pauseSync, resumeSync } from "@/lib/server-sync-client";
import { cn, formatDate } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { useThoughts } from "@/store/useThoughts";
import type { Thought, ThoughtCategory } from "@/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  EMPTY_THOUGHT_FORM,
  ThoughtForm,
  formToThought,
  thoughtToForm,
} from "./ThoughtForm";
import type { ThoughtFormState } from "./ThoughtForm";

const CATEGORY_STYLES: Record<ThoughtCategory, string> = {
  macro: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  sector: "border-purple-500/20 bg-purple-500/10 text-purple-400",
  stock: "border-accent/20 bg-accent/10 text-accent",
  strategy: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  review: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  other: "border-border bg-surface-3 text-text-muted",
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

function makeThoughtId(): string {
  return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ThoughtView({
  thought,
  onEdit,
}: {
  thought: Thought;
  onEdit: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <h1 className="mb-3 text-xl font-bold leading-snug text-text-primary">
          {thought.title}
        </h1>

        <p className="mb-5 text-xs text-text-muted">
          创建于 {formatDate(thought.createdAt)}
          {thought.updatedAt !== thought.createdAt && (
            <span> · 更新于 {formatDate(thought.updatedAt)}</span>
          )}
        </p>

        <MarkdownRenderer content={thought.content} />

        {thought.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5 border-t border-border pt-4">
            {thought.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-1 px-5 py-4">
        <Button
          variant="secondary"
          iconLeft={<Pencil className="h-3.5 w-3.5" />}
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
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const upsertThought = useThoughts((state) => state.upsertThought);
  const [mode, setMode] = useState<DrawerMode>(() => (!thought ? "edit" : initialMode));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(!thought ? "edit" : initialMode);
  }, [thought, initialMode]);

  useEffect(() => {
    if (open) {
      pauseSync();
    }
    return () => {
      if (open) {
        resumeSync();
      }
    };
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, submitting]);

  async function handleSubmit(data: ThoughtFormState) {
    const thoughtData = formToThought(data);
    setSubmitting(true);
    setError("");

    try {
      if (thought) {
        const nextThought: Thought = {
          ...thought,
          ...thoughtData,
          id: thought.id,
          createdAt: thought.createdAt,
          updatedAt: new Date().toISOString(),
        };

        const savedThought = await updateThoughtOnServer(activeUserId, nextThought);
        upsertThought(savedThought);
      } else {
        const now = new Date().toISOString();
        const nextThought: Thought = {
          ...thoughtData,
          id: makeThoughtId(),
          createdAt: now,
          updatedAt: now,
        };

        const savedThought = await saveThoughtToServer(activeUserId, nextThought);
        upsertThought(savedThought);
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || "保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const isEditing = Boolean(thought);
  const title = !thought ? "新建笔记" : mode === "view" ? "查看笔记" : "编辑笔记";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={submitting ? undefined : onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-border bg-surface-1 transition-transform duration-200 ease-in-out sm:w-[720px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            {isEditing && (
              <div className="flex rounded-md border border-border bg-surface-2 p-0.5">
                <button
                  onClick={() => setMode("view")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
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
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
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
            disabled={submitting}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {open &&
          (mode === "view" && thought ? (
            <ThoughtView thought={thought} onEdit={() => setMode("edit")} />
          ) : (
            <>
              {error && (
                <div className="mx-5 mt-3 rounded-lg border border-loss/20 bg-loss/10 px-3 py-2 text-xs text-loss">
                  {error}
                </div>
              )}
              <ThoughtForm
              key={thought?.id ?? "new"}
              initialValues={thought ? thoughtToForm(thought) : EMPTY_THOUGHT_FORM}
              onSubmit={(values) => {
                void handleSubmit(values);
              }}
              onCancel={onClose}
              submitLabel={submitting ? "提交中..." : isEditing ? "保存修改" : "创建笔记"}
            />
            </>
          ))}
      </div>
    </>
  );
}
