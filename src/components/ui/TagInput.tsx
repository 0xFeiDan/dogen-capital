"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
  clearLabel?: string;
}

export function TagInput({
  label,
  tags,
  onChange,
  placeholder = "输入标签，按 Enter 添加",
  hint,
  className,
  clearLabel = "清空标签",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, "");
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((item) => item !== tag));
  }

  function clearTags() {
    onChange([]);
    setInputValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    } else if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || tags.length > 0) && (
        <div className="flex items-center justify-between gap-3">
          {label ? (
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              {label}
            </label>
          ) : (
            <span />
          )}

          {tags.length > 0 && (
            <button
              type="button"
              onClick={clearTags}
              className="inline-flex items-center gap-1 text-2xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {clearLabel}
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-9 rounded-lg bg-surface-2 border border-border",
          "hover:border-border-strong transition-colors",
          "flex flex-wrap gap-1.5 p-1.5 cursor-text",
          "focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent/40"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-surface-3 border border-border px-2 py-0.5 text-xs text-text-secondary"
          >
            {tag}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeTag(tag);
              }}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(",")) {
              addTag(value);
            } else {
              setInputValue(value);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addTag(inputValue);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none px-1 py-0.5"
        />
      </div>

      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
