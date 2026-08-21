import { NextResponse } from "next/server";
import { badRequest, upstreamError } from "@/lib/api/response";
import { isRecord } from "@/lib/api/validation";
import {
  requireAuthenticatedApiRequest,
  validateSameOriginRequest,
} from "@/lib/auth/api";
import {
  getCryptoQuoteCurrency,
  type DcaMarketQuote,
} from "@/lib/dca-pricing";

interface BinanceBookTickerPayload {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface BitgetTickerPayload {
  symbol: string;
  lastPr?: string;
  askPr?: string;
  bidPr?: string;
  ts?: string;
}

interface BitgetTickersResponse {
  code?: string;
  msg?: string;
  requestTime?: number;
  data?: BitgetTickerPayload[];
}

const BINANCE_BOOK_TICKER_URL = "https://api.binance.com/api/v3/ticker/bookTicker";
const BINANCE_USDM_BOOK_TICKER_URL = "https://fapi.binance.com/fapi/v1/ticker/bookTicker";
const BITGET_SPOT_TICKERS_URL = "https://api.bitget.com/api/v2/spot/market/tickers";

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
  return sanitizeSymbols(symbols);
}

function parsePositivePrice(...values: Array<string | number | null | undefined>): number {
  for (const value of values) {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }

  return Number.NaN;
}

function parseBinanceQuote(payload: BinanceBookTickerPayload): DcaMarketQuote | null {
  const price = parsePositivePrice(payload.bidPrice, payload.askPrice);

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

function parseBitgetQuote(payload: BitgetTickerPayload): DcaMarketQuote | null {
  const price = parsePositivePrice(payload.lastPr, payload.bidPr, payload.askPr);
  const symbol = payload.symbol?.trim().toUpperCase();

  if (!symbol || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    assetClass: "crypto",
    symbol,
    price,
    currency: getCryptoQuoteCurrency(symbol, "USD"),
    source: "bitget",
    fetchedAt: payload.ts
      ? new Date(Number(payload.ts)).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchBinanceCryptoQuotesBatch(symbols: string[]): Promise<DcaMarketQuote[]> {
  if (symbols.length === 0) return [];

  const symbolsParam = JSON.stringify(symbols);
  const response = await fetch(
    `${BINANCE_BOOK_TICKER_URL}?symbols=${encodeURIComponent(symbolsParam)}`,
    { cache: "no-store" }
  );

  if (!response.ok) return [];

  const payloads = (await response.json()) as BinanceBookTickerPayload[];
  if (!Array.isArray(payloads)) return [];

  return payloads
    .map(parseBinanceQuote)
    .filter((quote): quote is DcaMarketQuote => quote != null);
}

async function fetchBinanceCryptoQuote(symbol: string): Promise<DcaMarketQuote | null> {
  const response = await fetch(
    `${BINANCE_BOOK_TICKER_URL}?symbol=${encodeURIComponent(symbol)}`,
    { cache: "no-store" }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as BinanceBookTickerPayload;
  return parseBinanceQuote(payload);
}

async function fetchBinanceCryptoQuotes(symbols: string[]): Promise<DcaMarketQuote[]> {
  const batchQuotes = await fetchBinanceCryptoQuotesBatch(symbols);
  if (batchQuotes.length > 0) {
    return batchQuotes;
  }

  const quotes = await Promise.all(symbols.map((symbol) => fetchBinanceCryptoQuote(symbol)));
  return quotes.filter((quote): quote is DcaMarketQuote => quote != null);
}

async function fetchBitgetCryptoQuote(symbol: string): Promise<DcaMarketQuote | null> {
  const response = await fetch(
    `${BITGET_SPOT_TICKERS_URL}?symbol=${encodeURIComponent(symbol)}`,
    { cache: "no-store" }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as BitgetTickersResponse;
  if (payload.code !== "00000" || !Array.isArray(payload.data)) {
    return null;
  }

  const normalizedSymbol = symbol.toUpperCase();
  const ticker =
    payload.data.find((item) => item.symbol?.toUpperCase() === normalizedSymbol) ??
    payload.data[0];

  return ticker ? parseBitgetQuote(ticker) : null;
}

async function fetchCryptoQuotes(symbols: string[]): Promise<DcaMarketQuote[]> {
  if (symbols.length === 0) return [];

  const binanceQuotes = await fetchBinanceCryptoQuotes(symbols);
  const binanceSymbols = new Set(binanceQuotes.map((quote) => quote.symbol.toUpperCase()));
  const missingSymbols = symbols.filter((symbol) => !binanceSymbols.has(symbol.toUpperCase()));

  if (missingSymbols.length === 0) {
    return binanceQuotes;
  }

  const bitgetQuotes = await Promise.all(
    missingSymbols.map((symbol) => fetchBitgetCryptoQuote(symbol))
  );

  return [
    ...binanceQuotes,
    ...bitgetQuotes.filter((quote): quote is DcaMarketQuote => quote != null),
  ];
}

async function fetchStockQuotes(symbols: string[]): Promise<DcaMarketQuote[]> {
  if (symbols.length === 0) return [];

  const response = await fetch(BINANCE_USDM_BOOK_TICKER_URL, {
    cache: "no-store",
  });
  if (!response.ok) return [];

  const payloads = (await response.json()) as BinanceBookTickerPayload[];
  if (!Array.isArray(payloads)) return [];

  const requestedSymbols = new Set(symbols);
  const fetchedAt = new Date().toISOString();

  return payloads.flatMap((payload) => {
    const symbol = payload.symbol?.trim().toUpperCase();
    const price = parsePositivePrice(payload.bidPrice, payload.askPrice);

    if (!symbol || !requestedSymbols.has(symbol) || !Number.isFinite(price) || price <= 0) {
      return [];
    }

    return [{
      assetClass: "stock" as const,
      symbol,
      price,
      currency: "USD" as const,
      source: "binance" as const,
      fetchedAt,
    }];
  });
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  if (!isRecord(body)) {
    return badRequest("Invalid quote payload");
  }

  const cryptoSymbols = sanitizeSymbols(
    Array.isArray(body.cryptoSymbols) ? body.cryptoSymbols.map(String) : undefined
  );
  const stockSymbols = sanitizeStockSymbols(
    Array.isArray(body.stockSymbols) ? body.stockSymbols.map(String) : undefined
  );

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
    return upstreamError(error, "Failed to fetch DCA market quotes");
  }
}
