"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { MarkdownEditor } from "./MarkdownEditor";
import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Thought, ThoughtCategory } from "@/types";

export interface ThoughtFormState {
  title: string;
  category: ThoughtCategory;
  ticker: string;
  tags: string[];
  isPrivate: boolean;
  content: string;
}

export const EMPTY_THOUGHT_FORM: ThoughtFormState = {
  title: "",
  category: "macro",
  ticker: "",
  tags: [],
  isPrivate: false,
  content: "",
};

export function thoughtToForm(thought: Thought): ThoughtFormState {
  return {
    title: thought.title,
    category: thought.category,
    ticker: thought.ticker ?? "",
    tags: thought.tags,
    isPrivate: thought.isPrivate ?? false,
    content: thought.content,
  };
}

export function formToThought(
  form: ThoughtFormState
): Omit<Thought, "id" | "createdAt" | "updatedAt"> {
  return {
    title: form.title.trim(),
    category: form.category,
    ticker: form.ticker.trim().toUpperCase() || undefined,
    tags: form.tags,
    isPrivate: form.isPrivate,
    content: form.content,
  };
}

export interface ThoughtFormErrors {
  title?: string;
  content?: string;
}

function validate(form: ThoughtFormState): ThoughtFormErrors {
  const errors: ThoughtFormErrors = {};
  if (!form.title.trim()) errors.title = "标题不能为空";
  if (!form.content.trim()) errors.content = "内容不能为空";
  return errors;
}

function PrivacyToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium transition-all duration-150",
        value
          ? "bg-accent/10 border-accent/30 text-accent"
          : "bg-surface-2 border-border text-text-muted hover:text-text-secondary hover:border-border-strong"
      )}
    >
      {value ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      {value ? "私密" : "公开"}
    </button>
  );
}

interface ThoughtFormProps {
  initialValues?: ThoughtFormState;
  onSubmit: (data: ThoughtFormState) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function ThoughtForm({
  initialValues = EMPTY_THOUGHT_FORM,
  onSubmit,
  onCancel,
  submitLabel = "保存笔记",
}: ThoughtFormProps) {
  const [form, setForm] = useState<ThoughtFormState>(initialValues);
  const [errors, setErrors] = useState<ThoughtFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set =
    <K extends keyof ThoughtFormState>(key: K) =>
    (value: ThoughtFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        if (submitted) setErrors(validate(next));
        return next;
      });
    };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitted(true);

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(form);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <Input
          label="标题 *"
          value={form.title}
          onChange={(event) => set("title")(event.target.value)}
          placeholder="笔记标题"
          error={errors.title}
          className="text-base"
        />

        <div className="grid grid-cols-3 gap-3">
          <Select
            label="分类"
            value={form.category}
            onChange={set("category") as (value: string) => void}
            options={[
              { value: "macro", label: "宏观" },
              { value: "sector", label: "行业" },
              { value: "stock", label: "个股" },
              { value: "strategy", label: "策略" },
              { value: "review", label: "复盘" },
              { value: "other", label: "其他" },
            ]}
          />
          <Input
            label="代码"
            value={form.ticker}
            onChange={(event) => set("ticker")(event.target.value.toUpperCase())}
            placeholder="如 NVDA"
            className="uppercase"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              隐私
            </span>
            <PrivacyToggle value={form.isPrivate} onChange={set("isPrivate")} />
          </div>
        </div>

        <TagInput
          label="标签"
          tags={form.tags}
          onChange={set("tags") as (value: string[]) => void}
          placeholder="输入自定义标签，按 Enter 添加"
          hint="标签完全自定义，可随时删除，也可以一键清空"
          clearLabel="清空全部标签"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            内容 *
          </span>
          <MarkdownEditor
            value={form.content}
            onChange={set("content")}
            minHeight={320}
          />
          {errors.content && <p className="text-xs text-loss">{errors.content}</p>}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
