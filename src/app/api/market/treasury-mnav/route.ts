import { NextResponse } from "next/server";
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

interface BmnrDailySnapshotsResponse {
  data?: {
    data?: BmnrDailySnapshot[];
    lastCalculated?: string;
    isStale?: boolean;
  };
}

interface BmnrDailySnapshot {
  date: string;
  ethHoldings: number;
  usdHoldings: number;
  sharesOutstanding: number;
  marketCap: number;
  navPerShare: number | null;
  mNav: number | null;
  totalNavValue: number;
  stockPrice: number;
  ethPrice: number;
  altAssetsValue?: number | null;
}

const STRATEGY_BITCOIN_KPIS_URL = "https://api.strategy.com/btc/bitcoinKpis";
const STRATEGY_MSTR_KPI_URL = "https://api.strategy.com/btc/mstrKpiData";
const BMNR_COMPANY_ID = "4bf5e88a-dfba-44d0-bdfb-7d878cbd10db";
const BMNR_DAILY_SNAPSHOTS_URL = "https://api.bmnr.rocks/api/treasury/daily-snapshots";

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

async function fetchBmnrMnavItem() {
  const url = new URL(BMNR_DAILY_SNAPSHOTS_URL);
  url.searchParams.set("companyId", BMNR_COMPANY_ID);
  url.searchParams.set("fromDate", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));

  const response = await fetchJson<BmnrDailySnapshotsResponse>(url.toString());
  const snapshots = response.data?.data ?? [];
  const latest = snapshots.at(-1);

  if (!latest) {
    throw new Error("BMNR mNAV data is incomplete");
  }

  const ethNavUsd = latest.ethHoldings * latest.ethPrice;
  const otherNavUsd = latest.altAssetsValue ?? 0;
  const totalNavValue =
    latest.totalNavValue > 0
      ? latest.totalNavValue
      : ethNavUsd + latest.usdHoldings + otherNavUsd;
  const mnav =
    latest.mNav != null && latest.mNav > 0
      ? latest.mNav
      : latest.marketCap > 0 && totalNavValue > 0
        ? latest.marketCap / totalNavValue
        : undefined;

  return {
    ticker: "BMNR",
    name: "BitMine",
    stockPrice: round(latest.stockPrice, 2),
    currency: "USD",
    marketCapUsd: round(latest.marketCap),
    tokenMarketValueUsd: round(ethNavUsd),
    mnav: mnav != null ? round(mnav, 3) : null,
    holdings: [
      {
        asset: "ETH",
        units: latest.ethHoldings,
        priceUsd: round(latest.ethPrice, 2),
        valueUsd: round(ethNavUsd),
      },
    ],
    sourceAsOf: response.data?.lastCalculated ?? latest.date,
    sourceUrl: "https://bmnr.rocks/",
  };
}

export async function GET() {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const sources = [
    { label: "MSTR", load: fetchStrategyMnavItem },
    { label: "BMNR", load: fetchBmnrMnavItem },
  ] as const;
  const results = await Promise.allSettled(sources.map((source) => source.load()));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const errors = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];

    const reason = result.reason instanceof Error ? result.reason.message : "Failed to fetch";
    return [`${sources[index].label}: ${reason}`];
  });

  if (items.length > 0) {
    return NextResponse.json({
      items,
      fetchedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  return NextResponse.json(
    { error: errors.join(" / ") || "Failed to fetch mNAV data" },
    { status: 502 }
  );
}
