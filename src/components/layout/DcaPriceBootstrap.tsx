"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { getDcaQuoteSymbol } from "@/lib/dca-pricing";
import { fetchDcaQuotes } from "@/lib/market-client";
import { updateDcaLivePricesOnServer } from "@/lib/server-sync-client";
import { useAppUsers } from "@/store/useAppUsers";
import { useDcaEntries } from "@/store/useDcaEntries";
import type { Currency, DcaEntry } from "@/types";

const DCA_REFRESH_INTERVAL_MS = 30000;

export function DcaPriceBootstrap() {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const hydrated = useDcaEntries((state) => state._hydrated);
  const entries = useDcaEntries((state) => state.entries);
  const applyLivePriceUpdates = useDcaEntries((state) => state.applyLivePriceUpdates);
  const requestInFlightRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);

  const quoteEntries = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          symbol: getDcaQuoteSymbol(entry),
        }))
        .filter((item): item is { entry: DcaEntry; symbol: string } => Boolean(item.symbol)),
    [entries]
  );

  const quoteEntryKey = useMemo(
    () => quoteEntries.map(({ entry, symbol }) => `${entry.id}:${symbol}`).sort().join(","),
    [quoteEntries]
  );

  const refreshQuotes = useCallback(async () => {
    if (!hydrated || quoteEntries.length === 0) {
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
      const cryptoSymbols = Array.from(
        new Set(
          quoteEntries
            .filter(({ entry }) => entry.assetClass === "crypto")
            .map(({ symbol }) => symbol)
        )
      );
      const stockSymbols = Array.from(
        new Set(
          quoteEntries
            .filter(({ entry }) => entry.assetClass === "stock")
            .map(({ symbol }) => symbol)
        )
      );

      const quotes = await fetchDcaQuotes({ cryptoSymbols, stockSymbols });
      const quotesByKey = new Map(
        quotes.map((quote) => [`${quote.assetClass}:${quote.symbol.toUpperCase()}`, quote])
      );

      const updates = quoteEntries
        .map(({ entry, symbol }) => {
          const quote = quotesByKey.get(`${entry.assetClass}:${symbol.toUpperCase()}`);
          if (!quote) return null;

          if (!Number.isFinite(quote.price) || quote.price <= 0) return null;

          const priceUpdatedAt = quote.fetchedAt;
          const changed =
            entry.currentPrice !== quote.price ||
            entry.quoteSymbol !== quote.symbol ||
            entry.quoteCurrency !== quote.currency;

          if (!changed) return null;

          return {
            id: entry.id,
            currentPrice: quote.price,
            quoteSymbol: quote.symbol,
            quoteCurrency: quote.currency,
            priceUpdatedAt,
          };
        })
        .filter(
          (
            update
          ): update is {
            id: string;
            currentPrice: number;
            quoteSymbol: string;
            quoteCurrency: Currency;
            priceUpdatedAt: string;
          } => update != null
        );

      if (updates.length > 0) {
        applyLivePriceUpdates(updates);
        void updateDcaLivePricesOnServer(activeUserId, updates).catch(() => {
          // Local marks can update even if the server write temporarily fails.
        });
      }

      consecutiveFailuresRef.current = 0;
    } catch {
      consecutiveFailuresRef.current += 1;
    } finally {
      requestInFlightRef.current = false;
    }
  }, [activeUserId, applyLivePriceUpdates, entries, hydrated, quoteEntries]);

  useEffect(() => {
    if (!hydrated || quoteEntries.length === 0) {
      return;
    }

    void refreshQuotes();

    const interval = window.setInterval(() => {
      if (consecutiveFailuresRef.current >= 10) return;
      void refreshQuotes();
    }, DCA_REFRESH_INTERVAL_MS);

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
    // Use stable key instead of quoteEntries array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, quoteEntryKey]);

  return null;
}
