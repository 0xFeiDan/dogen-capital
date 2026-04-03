"use client";

import type { BinanceBookTickerSnapshot } from "@/lib/pricing";

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
