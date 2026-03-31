"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, Pencil, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}

type EditorMode = "write" | "preview";

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your thoughts… Markdown is supported.",
  minHeight = 280,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);

  // Tab key inserts two spaces
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const next = value.substring(0, start) + "  " + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  }

  const wc = wordCount(value);
  const lines = value === "" ? 0 : value.split("\n").length;

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent/40 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
        <div className="flex rounded-md bg-surface-3 p-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              mode === "write"
                ? "bg-surface-4 text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Pencil className="w-3 h-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              mode === "preview"
                ? "bg-surface-4 text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-3 text-2xs text-text-muted">
          <span className="flex items-center gap-1">
            <Type className="w-2.5 h-2.5" />
            {wc} words
          </span>
          <span>{lines} lines</span>
          <span className="hidden sm:inline text-2xs text-text-muted/60">
            Markdown
          </span>
        </div>
      </div>

      {/* Content */}
      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full bg-surface-1 text-sm text-text-primary font-mono",
            "px-4 py-3 resize-none outline-none",
            "placeholder:text-text-muted leading-relaxed"
          )}
          style={{ minHeight }}
        />
      ) : (
        <div
          className="min-h-[var(--min-h)] px-4 py-3 bg-surface-1 overflow-y-auto"
          style={
            { "--min-h": `${minHeight}px` } as React.CSSProperties
          }
        >
          {value.trim() === "" ? (
            <p className="text-text-muted text-sm italic">Nothing to preview.</p>
          ) : (
            <MarkdownRenderer content={value} />
          )}
        </div>
      )}
    </div>
  );
}
