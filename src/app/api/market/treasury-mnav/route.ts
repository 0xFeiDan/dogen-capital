import { NextResponse } from "next/server";
import { upstreamError } from "@/lib/api/response";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

interface StrategyBitcoinKpisResponse {
  timestamp?: string;
  results?: {
    ufPrice?: number;
    latestPrice?: number;
    btcHoldings?: string;
    btcNavNumber?: number;
  };
}

interface StrategyMstrKpi {
  company?: string;
  ufPrice?: number;
  timeStampUtc?: string;
  price?: string;
  marketCap?: string;
  entVal?: string;
}

const STRATEGY_BITCOIN_KPIS_URL = "https://api.strategy.com/btc/bitcoinKpis";
const STRATEGY_MSTR_KPI_URL = "https://api.strategy.com/btc/mstrKpiData";
const CACHE_TTL_MS = 10 * 60 * 1000;

type TreasuryMnavPayload = {
  items: Awaited<ReturnType<typeof fetchStrategyMnavItem>>[];
  fetchedAt: string;
};

let cachedPayload: { expiresAt: number; payload: TreasuryMnavPayload } | null = null;
let pendingPayload: Promise<TreasuryMnavPayload> | null = null;

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const numberValue = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parsePositiveNumber(value: unknown): number | undefined {
  const numberValue = parseNumber(value);
  return numberValue != null && numberValue > 0 ? numberValue : undefined;
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 DogenCapital/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchStrategyMnavItem() {
  const [bitcoinKpis, mstrKpis] = await Promise.all([
    fetchJson<StrategyBitcoinKpisResponse>(STRATEGY_BITCOIN_KPIS_URL),
    fetchJson<StrategyMstrKpi[]>(STRATEGY_MSTR_KPI_URL),
  ]);

  const bitcoinResults = bitcoinKpis.results;
  const mstrKpi = mstrKpis.find((item) => item.company === "MSTR") ?? mstrKpis[0];
  const btcUnits = parsePositiveNumber(bitcoinResults?.btcHoldings);
  const btcPrice = parsePositiveNumber(bitcoinResults?.ufPrice ?? bitcoinResults?.latestPrice);
  const stockPrice = parsePositiveNumber(mstrKpi?.ufPrice ?? mstrKpi?.price);
  const btcNavUsd =
    parsePositiveNumber(bitcoinResults?.btcNavNumber) != null
      ? parsePositiveNumber(bitcoinResults?.btcNavNumber)! * 1_000_000
      : btcUnits != null && btcPrice != null
        ? btcUnits * btcPrice
        : undefined;
  const marketCapUsd =
    parsePositiveNumber(mstrKpi?.marketCap) != null
      ? parsePositiveNumber(mstrKpi?.marketCap)! * 1_000_000
      : undefined;
  const enterpriseValueUsd =
    parsePositiveNumber(mstrKpi?.entVal) != null
      ? parsePositiveNumber(mstrKpi?.entVal)! * 1_000_000
      : undefined;
  const mnav =
    enterpriseValueUsd != null && btcNavUsd != null && btcNavUsd > 0
      ? enterpriseValueUsd / btcNavUsd
      : undefined;

  if (btcUnits == null || btcPrice == null || btcNavUsd == null || marketCapUsd == null) {
    throw new Error("Strategy mNAV data is incomplete");
  }

  return {
    ticker: "MSTR",
    name: "Strategy",
    stockPrice: stockPrice != null ? round(stockPrice, 2) : null,
    currency: "USD",
    marketCapUsd: round(marketCapUsd),
    tokenMarketValueUsd: round(btcNavUsd),
    mnav: mnav != null ? round(mnav, 3) : null,
    holdings: [
      {
        asset: "BTC",
        units: btcUnits,
        priceUsd: round(btcPrice, 2),
        valueUsd: round(btcNavUsd),
      },
    ],
    sourceAsOf: mstrKpi?.timeStampUtc ?? bitcoinKpis.timestamp ?? null,
    sourceUrl: "https://www.strategy.com/",
    dataAsOf: {
      prices: mstrKpi?.timeStampUtc ?? bitcoinKpis.timestamp ?? null,
      holdings: bitcoinKpis.timestamp ?? mstrKpi?.timeStampUtc ?? null,
    },
  };
}

async function loadTreasuryMnavPayload(): Promise<TreasuryMnavPayload> {
  const mstr = await fetchStrategyMnavItem();

  return {
    items: [mstr],
    fetchedAt: new Date().toISOString(),
  };
}

async function getCachedTreasuryMnavPayload(): Promise<TreasuryMnavPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.expiresAt > now) {
    return cachedPayload.payload;
  }

  if (!pendingPayload) {
    pendingPayload = loadTreasuryMnavPayload()
      .then((payload) => {
        cachedPayload = {
          payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        return payload;
      })
      .finally(() => {
        pendingPayload = null;
      });
  }

  return pendingPayload;
}

export async function GET() {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  try {
    return NextResponse.json(await getCachedTreasuryMnavPayload());
  } catch {
    return upstreamError("mNAV unavailable", "Failed to fetch mNAV data");
  }
}
