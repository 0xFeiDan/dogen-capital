import { NextResponse } from "next/server";
import {
  requireAuthenticatedApiRequest,
  validateSameOriginRequest,
} from "@/lib/auth/api";
import {
  getCryptoQuoteCurrency,
  isSupportedQuoteCurrency,
  type DcaMarketQuote,
} from "@/lib/dca-pricing";
import type { Currency } from "@/types";

interface DcaQuotesRequest {
  cryptoSymbols?: string[];
  stockSymbols?: string[];
}

interface BinanceBookTickerPayload {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
    }>;
  };
}

function sanitizeSymbols(symbols?: string[], pattern = /[^A-Z0-9]/g): string[] {
  if (!Array.isArray(symbols)) return [];

  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase().replace(pattern, ""))
        .filter(Boolean)
    )
  ).slice(0, 40);
}

function sanitizeStockSymbols(symbols?: string[]): string[] {
  return sanitizeSymbols(symbols, /[^A-Z0-9.^=-]/g);
}

function parseBinanceQuote(payload: BinanceBookTickerPayload): DcaMarketQuote | null {
  const price = Number(payload.bidPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    assetClass: "crypto",
    symbol: payload.symbol,
    price,
    currency: getCryptoQuoteCurrency(payload.symbol, "USD"),
    source: "binance",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchCryptoQuotes(symbols: string[]): Promise<DcaMarketQuote[]> {
  if (symbols.length === 0) return [];

  const symbolsParam = JSON.stringify(symbols);
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/bookTicker?symbols=${encodeURIComponent(symbolsParam)}`,
    { cache: "no-store" }
  );

  if (!response.ok) return [];

  const payloads = (await response.json()) as BinanceBookTickerPayload[];
  if (!Array.isArray(payloads)) return [];

  return payloads
    .map(parseBinanceQuote)
    .filter((quote): quote is DcaMarketQuote => quote != null);
}

async function fetchStockQuote(symbol: string): Promise<DcaMarketQuote | null> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1m`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 DogenCapital/1.0",
      },
    }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as YahooChartPayload;
  const meta = payload.chart?.result?.[0]?.meta;
  const price = Number(
    meta?.regularMarketPrice ?? meta?.previousClose ?? meta?.chartPreviousClose
  );
  const currency = String(meta?.currency ?? "USD").toUpperCase();

  if (!Number.isFinite(price) || price <= 0 || !isSupportedQuoteCurrency(currency)) {
    return null;
  }

  return {
    assetClass: "stock",
    symbol: (meta?.symbol ?? symbol).toUpperCase(),
    price,
    currency: currency as Currency,
    source: "yahoo",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchStockQuotes(symbols: string[]): Promise<DcaMarketQuote[]> {
  if (symbols.length === 0) return [];

  const responses = await Promise.all(symbols.map((symbol) => fetchStockQuote(symbol)));
  return responses.filter((quote): quote is DcaMarketQuote => quote != null);
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  let body: DcaQuotesRequest;

  try {
    body = (await request.json()) as DcaQuotesRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const cryptoSymbols = sanitizeSymbols(body.cryptoSymbols);
  const stockSymbols = sanitizeStockSymbols(body.stockSymbols);

  try {
    const [cryptoQuotes, stockQuotes] = await Promise.all([
      fetchCryptoQuotes(cryptoSymbols),
      fetchStockQuotes(stockSymbols),
    ]);

    return NextResponse.json({
      quotes: [...cryptoQuotes, ...stockQuotes],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch DCA market quotes";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
