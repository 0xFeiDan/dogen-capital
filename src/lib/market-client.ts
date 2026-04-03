"use client";

import {
  normalizeBinanceSymbol,
  type BinanceBookTickerSnapshot,
} from "@/lib/pricing";
import type { BinanceMarketType } from "@/types";

interface BinanceQuotesResponse {
  quotes: BinanceBookTickerSnapshot[];
  fetchedAt: string;
  error?: string;
}

export async function fetchBinanceQuotes(params: {
  spotSymbols: string[];
  usdmFuturesSymbols: string[];
}): Promise<BinanceBookTickerSnapshot[]> {
  const response = await fetch("/api/market/binance/quotes", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = (await response.json()) as BinanceQuotesResponse;

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch Binance quotes");
  }

  return data.quotes ?? [];
}

export async function fetchBinanceQuote(params: {
  marketType: BinanceMarketType;
  symbol?: string | null;
}): Promise<BinanceBookTickerSnapshot | null> {
  const symbol = normalizeBinanceSymbol(params.symbol);

  if (!symbol) {
    return null;
  }

  const quotes = await fetchBinanceQuotes({
    spotSymbols: params.marketType === "spot" ? [symbol] : [],
    usdmFuturesSymbols: params.marketType === "usdm-futures" ? [symbol] : [],
  });

  return (
    quotes.find(
      (quote) =>
        quote.marketType === params.marketType &&
        normalizeBinanceSymbol(quote.symbol) === symbol
    ) ?? null
  );
}
