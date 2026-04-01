"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pauseSync, resumeSync, saveTradeToServer, updateTradeOnServer } from "@/lib/server-sync-client";
import { useAppUsers } from "@/store/useAppUsers";
import { useTrades } from "@/store/useTrades";
import type { Trade } from "@/types";
import { EMPTY_FORM, TradeForm, formToTrade, tradeToForm } from "./TradeForm";
import type { TradeFormState } from "./TradeForm";

interface TradeDrawerProps {
  open: boolean;
  onClose: () => void;
  editingTrade?: Trade | null;
}

function makeTradeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function TradeDrawer({ open, onClose, editingTrade }: TradeDrawerProps) {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const upsertTrade = useTrades((state) => state.upsertTrade);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, submitting]);

  async function handleSubmit(data: TradeFormState) {
    const tradeData = formToTrade(data);
    setSubmitting(true);
    setError("");

    try {
      if (editingTrade) {
        const trade: Trade = {
          ...editingTrade,
          ...tradeData,
          id: editingTrade.id,
          createdAt: editingTrade.createdAt,
          updatedAt: new Date().toISOString(),
        };

        const savedTrade = await updateTradeOnServer(activeUserId, trade);
        upsertTrade(savedTrade);
      } else {
        const now = new Date().toISOString();
        const trade: Trade = {
          ...tradeData,
          id: makeTradeId(),
          createdAt: now,
          updatedAt: now,
        };

        const savedTrade = await saveTradeToServer(activeUserId, trade);
        upsertTrade(savedTrade);
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || "保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const initialValues = editingTrade ? tradeToForm(editingTrade) : EMPTY_FORM;
  const isEditing = Boolean(editingTrade);

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
          "fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-border bg-surface-1 shadow-[0_0_32px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out sm:w-[560px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="交易表单"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50 lg:hidden"
              aria-label="关闭"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">
              {isEditing ? "编辑交易" : "新增交易"}
            </h2>
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

        {open && (
          <>
            {error && (
              <div className="mx-5 mt-3 rounded-lg border border-loss/20 bg-loss/10 px-3 py-2 text-xs text-loss">
                {error}
              </div>
            )}
            <TradeForm
            key={editingTrade?.id ?? "new"}
            initialValues={initialValues}
            onSubmit={(values) => {
              void handleSubmit(values);
            }}
            onCancel={onClose}
            submitLabel={submitting ? "提交中..." : isEditing ? "保存修改" : "添加交易"}
          />
          </>
        )}
      </div>
    </>
  );
}
