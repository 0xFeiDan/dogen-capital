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

interface TwelveDataQuotePayload {
  symbol?: string;
  currency?: string;
  exchange?: string;
  mic_code?: string;
  close?: string | number | null;
  previous_close?: string | number | null;
  extended_price?: string | number | null;
  status?: string;
  message?: string;
  code?: number;
}

const TWELVE_DATA_API_URL = "https://api.twelvedata.com/quote";
const TWELVE_DATA_CACHE_MS =
  Math.max(15, Number(process.env.TWELVEDATA_CACHE_SECONDS ?? 60)) * 1000;
const stockQuoteCache = new Map<
  string,
  { quote: DcaMarketQuote | null; expiresAt: number }
>();

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

function parseTwelveDataPrice(payload: TwelveDataQuotePayload): number {
  const candidates = [
    payload.extended_price,
    payload.close,
    payload.previous_close,
  ];

  for (const candidate of candidates) {
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }

  return Number.NaN;
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
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return null;

  const cacheKey = symbol.toUpperCase();
  const cached = stockQuoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quote;
  }

  const url = new URL(TWELVE_DATA_API_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("interval", "1min");

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    stockQuoteCache.set(cacheKey, {
      quote: null,
      expiresAt: Date.now() + TWELVE_DATA_CACHE_MS,
    });
    return null;
  }

  const payload = (await response.json()) as TwelveDataQuotePayload;
  if (payload.status === "error") {
    stockQuoteCache.set(cacheKey, {
      quote: null,
      expiresAt: Date.now() + TWELVE_DATA_CACHE_MS,
    });
    return null;
  }

  const price = parseTwelveDataPrice(payload);
  const currency = String(payload.currency ?? "USD").toUpperCase();

  if (!Number.isFinite(price) || price <= 0 || !isSupportedQuoteCurrency(currency)) {
    stockQuoteCache.set(cacheKey, {
      quote: null,
      expiresAt: Date.now() + TWELVE_DATA_CACHE_MS,
    });
    return null;
  }

  const quote: DcaMarketQuote = {
    assetClass: "stock",
    symbol: (payload.symbol ?? symbol).toUpperCase(),
    price,
    currency: currency as Currency,
    source: "twelvedata",
    fetchedAt: new Date().toISOString(),
  };

  stockQuoteCache.set(cacheKey, {
    quote,
    expiresAt: Date.now() + TWELVE_DATA_CACHE_MS,
  });

  return quote;
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
