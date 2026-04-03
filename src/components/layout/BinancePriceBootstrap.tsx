"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { fetchBinanceQuotes } from "@/lib/market-client";
import {
  getTradeSettlementPrice,
  isBinancePricingEnabled,
  normalizeBinanceSymbol,
} from "@/lib/pricing";
import { updateTradeLivePricesOnServer } from "@/lib/server-sync-client";
import { useAppUsers } from "@/store/useAppUsers";
import { useTrades } from "@/store/useTrades";
import type { Trade } from "@/types";

const BINANCE_REFRESH_INTERVAL_MS = 5000;

export function BinancePriceBootstrap() {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const hydrated = useTrades((state) => state._hydrated);
  const trades = useTrades((state) => state.trades);
  const applyLivePriceUpdates = useTrades((state) => state.applyLivePriceUpdates);
  const requestInFlightRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);

  const openBinanceTrades = useMemo(
    () =>
      trades.filter(
        (
          trade
        ): trade is Trade & {
          pricingMode: "binance";
          binanceMarketType: "spot" | "usdm-futures";
          binanceSymbol: string;
        } => trade.status === "open" && isBinancePricingEnabled(trade)
      ),
    [trades]
  );

  // Stable key: only changes when the set of open binance trade IDs changes
  const openBinanceTradeKey = useMemo(
    () => openBinanceTrades.map((t) => t.id).sort().join(","),
    [openBinanceTrades]
  );

  const refreshQuotes = useCallback(async () => {
    if (!hydrated || openBinanceTrades.length === 0) {
      return;
    }

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;

    try {
      const spotSymbols = Array.from(
        new Set(
          openBinanceTrades
            .filter((trade) => trade.binanceMarketType === "spot")
            .map((trade) => trade.binanceSymbol)
        )
      );
      const usdmFuturesSymbols = Array.from(
        new Set(
          openBinanceTrades
            .filter((trade) => trade.binanceMarketType === "usdm-futures")
            .map((trade) => trade.binanceSymbol)
        )
      );

      const quotes = await fetchBinanceQuotes({
        spotSymbols,
        usdmFuturesSymbols,
      });
      const quotesByKey = new Map(
        quotes.map((quote) => [
          `${quote.marketType}:${normalizeBinanceSymbol(quote.symbol)}`,
          quote,
        ])
      );

      const updates = openBinanceTrades
        .map((trade) => {
          const key = `${trade.binanceMarketType}:${normalizeBinanceSymbol(
            trade.binanceSymbol
          )}`;
          const quote = quotesByKey.get(key);

          if (!quote) return null;

          const currentPrice = getTradeSettlementPrice(trade, quote);
          if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
          if (trade.currentPrice === currentPrice) return null;

          return {
            id: trade.id,
            currentPrice,
          };
        })
        .filter(
          (update): update is { id: string; currentPrice: number } => update != null
        );

      if (updates.length > 0) {
        await updateTradeLivePricesOnServer(activeUserId, updates);
        applyLivePriceUpdates(updates);
      }

      consecutiveFailuresRef.current = 0;
    } catch {
      consecutiveFailuresRef.current += 1;
    } finally {
      requestInFlightRef.current = false;
    }
  }, [activeUserId, applyLivePriceUpdates, hydrated, openBinanceTrades]);

  useEffect(() => {
    if (!hydrated || openBinanceTrades.length === 0) {
      return;
    }

    void refreshQuotes();

    const interval = window.setInterval(() => {
      // Stop polling after 10 consecutive failures (e.g. session expired)
      if (consecutiveFailuresRef.current >= 10) return;
      void refreshQuotes();
    }, BINANCE_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        consecutiveFailuresRef.current = 0;
        void refreshQuotes();
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // Use stable key instead of openBinanceTrades array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, openBinanceTradeKey]);

  return null;
}
