"use client";

import { useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPTY_FORM, TradeForm, formToTrade, tradeToForm } from "./TradeForm";
import type { TradeFormState } from "./TradeForm";
import { useTrades } from "@/store/useTrades";
import type { Trade } from "@/types";

interface TradeDrawerProps {
  open: boolean;
  onClose: () => void;
  editingTrade?: Trade | null;
}

export function TradeDrawer({ open, onClose, editingTrade }: TradeDrawerProps) {
  const { addTrade, updateTrade } = useTrades();

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

  function handleSubmit(data: TradeFormState) {
    const tradeData = formToTrade(data);

    if (editingTrade) {
      updateTrade(editingTrade.id, tradeData);
    } else {
      addTrade(tradeData);
    }

    onClose();
  }

  const initialValues = editingTrade ? tradeToForm(editingTrade) : EMPTY_FORM;
  const isEditing = !!editingTrade;

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
          "fixed top-0 right-0 z-40 h-full w-full sm:w-[560px]",
          "bg-surface-1 border-l border-border flex flex-col",
          "transition-transform duration-200 ease-in-out shadow-[0_0_32px_rgba(0,0,0,0.25)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Trade form"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors lg:hidden"
              aria-label="Close"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">
              {isEditing ? "编辑交易" : "新增交易"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {open && (
          <TradeForm
            key={editingTrade?.id ?? "new"}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel={isEditing ? "保存修改" : "添加交易"}
          />
        )}
      </div>
    </>
  );
}
