import { NextResponse } from "next/server";
import { upstreamError } from "@/lib/api/response";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";
import { fetchBmnrMnavFromSec } from "@/lib/bmnr-mnav";

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
  };
}

export async function GET() {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const sources = [
    { label: "MSTR", load: fetchStrategyMnavItem },
    { label: "BMNR", load: fetchBmnrMnavFromSec },
  ] as const;
  const results = await Promise.allSettled(sources.map((source) => source.load()));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const errors = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];

    console.error(`Failed to fetch ${sources[index].label} mNAV`, result.reason);
    return [`${sources[index].label}: unavailable`];
  });

  if (items.length > 0) {
    return NextResponse.json({
      items,
      fetchedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  return upstreamError(errors.join(" / "), "Failed to fetch mNAV data");
}
