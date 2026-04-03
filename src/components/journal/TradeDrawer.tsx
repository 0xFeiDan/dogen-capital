"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { fetchBinanceQuote } from "@/lib/market-client";
import { getTradeSettlementPrice, isBinancePricingEnabled } from "@/lib/pricing";
import {
  pauseSync,
  resumeSync,
  saveTradeToServer,
  updateTradeOnServer,
} from "@/lib/server-sync-client";
import { cn } from "@/lib/utils";
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

const TRADE_DRAWER_LABEL = "\u4ea4\u6613\u8868\u5355";
const CLOSE_LABEL = "\u5173\u95ed";
const CREATE_TITLE = "\u65b0\u589e\u4ea4\u6613";
const EDIT_TITLE = "\u7f16\u8f91\u4ea4\u6613";
const SAVE_ERROR = "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const INVALID_BINANCE_SYMBOL = (
  symbol: string
) => `\u5e01\u5b89\u672a\u627e\u5230 ${symbol}\uff0c\u8bf7\u68c0\u67e5\u4ee3\u7801\u540e\u518d\u4fdd\u5b58`;
const SUBMITTING_LABEL = "\u63d0\u4ea4\u4e2d...";
const SAVE_CHANGES_LABEL = "\u4fdd\u5b58\u4fee\u6539";
const ADD_TRADE_LABEL = "\u6dfb\u52a0\u4ea4\u6613";

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
    let tradeData = formToTrade(data);
    setSubmitting(true);
    setError("");

    try {
      if (isBinancePricingEnabled(tradeData)) {
        const quote = await fetchBinanceQuote({
          marketType: tradeData.binanceMarketType,
          symbol: tradeData.binanceSymbol,
        });

        if (!quote) {
          throw new Error(INVALID_BINANCE_SYMBOL(tradeData.binanceSymbol));
        }

        if (tradeData.status === "open") {
          tradeData = {
            ...tradeData,
            currentPrice: getTradeSettlementPrice(tradeData, quote),
          };
        }
      }

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
      setError((err as Error).message || SAVE_ERROR);
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
        aria-label={TRADE_DRAWER_LABEL}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50 lg:hidden"
              aria-label={CLOSE_LABEL}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">
              {isEditing ? EDIT_TITLE : CREATE_TITLE}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            aria-label={CLOSE_LABEL}
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
              submitLabel={
                submitting
                  ? SUBMITTING_LABEL
                  : isEditing
                    ? SAVE_CHANGES_LABEL
                    : ADD_TRADE_LABEL
              }
            />
          </>
        )}
      </div>
    </>
  );
}
