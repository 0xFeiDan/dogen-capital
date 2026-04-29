import { NextResponse } from "next/server";
import { badRequest, upstreamError } from "@/lib/api/response";
import { isRecord } from "@/lib/api/validation";
import {
  requireAuthenticatedApiRequest,
  validateSameOriginRequest,
} from "@/lib/auth/api";
import {
  normalizeBinanceSymbol,
  type BinanceBookTickerSnapshot,
} from "@/lib/pricing";

interface BinanceBookTickerPayload {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

function sanitizeSymbols(symbols?: string[]): string[] {
  if (!Array.isArray(symbols)) return [];

  return Array.from(
    new Set(
      symbols
        .map((symbol) => normalizeBinanceSymbol(symbol))
        .filter((symbol): symbol is string => Boolean(symbol))
    )
  ).slice(0, 30);
}

function parseQuote(
  marketType: BinanceBookTickerSnapshot["marketType"],
  payload: BinanceBookTickerPayload
): BinanceBookTickerSnapshot | null {
  const bidPrice = Number(payload.bidPrice);
  const bidQty = Number(payload.bidQty);
  const askPrice = Number(payload.askPrice);
  const askQty = Number(payload.askQty);

  if (
    !Number.isFinite(bidPrice) ||
    !Number.isFinite(bidQty) ||
    !Number.isFinite(askPrice) ||
    !Number.isFinite(askQty)
  ) {
    return null;
  }

  return {
    marketType,
    symbol: payload.symbol,
    bidPrice,
    bidQty,
    askPrice,
    askQty,
  };
}

async function fetchSpotQuotes(symbols: string[]): Promise<BinanceBookTickerSnapshot[]> {
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
    .map((payload) => parseQuote("spot", payload))
    .filter((item): item is BinanceBookTickerSnapshot => item != null);
}

async function fetchUsdmFuturesQuotes(
  symbols: string[]
): Promise<BinanceBookTickerSnapshot[]> {
  if (symbols.length === 0) return [];

  // Binance Futures bookTicker does not support symbols array param,
  // so we fetch all tickers and filter client-side
  if (symbols.length > 5) {
    const response = await fetch(
      "https://fapi.binance.com/fapi/v1/ticker/bookTicker",
      { cache: "no-store" }
    );

    if (!response.ok) return [];

    const payloads = (await response.json()) as BinanceBookTickerPayload[];
    if (!Array.isArray(payloads)) return [];

    const symbolSet = new Set(symbols);
    return payloads
      .filter((payload) => symbolSet.has(payload.symbol))
      .map((payload) => parseQuote("usdm-futures", payload))
      .filter((item): item is BinanceBookTickerSnapshot => item != null);
  }

  const responses = await Promise.all(
    symbols.map(async (symbol) => {
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" }
      );

      if (!response.ok) return null;

      const payload = (await response.json()) as BinanceBookTickerPayload;
      return parseQuote("usdm-futures", payload);
    })
  );

  return responses.filter((item): item is BinanceBookTickerSnapshot => item != null);
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

  const spotSymbols = sanitizeSymbols(
    Array.isArray(body.spotSymbols) ? body.spotSymbols.map(String) : undefined
  );
  const usdmFuturesSymbols = sanitizeSymbols(
    Array.isArray(body.usdmFuturesSymbols)
      ? body.usdmFuturesSymbols.map(String)
      : undefined
  );

  try {
    const [spotQuotes, usdmFuturesQuotes] = await Promise.all([
      fetchSpotQuotes(spotSymbols),
      fetchUsdmFuturesQuotes(usdmFuturesSymbols),
    ]);

    return NextResponse.json({
      quotes: [...spotQuotes, ...usdmFuturesQuotes],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return upstreamError(error, "Failed to fetch Binance quotes");
  }
}
