"use client";

import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  loading?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "确认",
  confirmVariant = "danger",
  onConfirm,
  loading = false,
}: DialogProps) {
  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-xl bg-surface-1 border border-border",
          "shadow-card p-6 animate-fade-in"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-loss/10 border border-loss/20 shrink-0">
            <AlertTriangle className="w-4 h-4 text-loss" />
          </div>
          <div>
            <h2
              id="dialog-title"
              className="text-sm font-semibold text-text-primary"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
