import type { DcaEntry } from "@/types";

const HYPURRSCAN_URL = "https://hypurrscan.io/address";
const HYPERLIQUID_UI_INFO_URL = "https://api-ui.hyperliquid.xyz/info";
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const FILL_PAGE_LIMIT = 2000;
const MAX_FILL_PAGES = 50;

interface HyperliquidFill {
  coin: string;
  px: string;
  sz: string;
  side?: string;
  time: number;
  dir: string;
  hash: string;
  fee: string;
  tid?: number | string | null;
  feeToken?: string | null;
  twapId?: number | string | null;
}

interface SpotToken {
  name: string;
  index: number;
  fullName?: string;
}

interface SpotMarket {
  name: string;
  index: number;
  tokens: [number, number];
}

interface SpotMeta {
  tokens: SpotToken[];
  universe: SpotMarket[];
}

interface SpotAssetContext {
  coin?: string;
  markPx?: string;
  midPx?: string;
}

interface MarketInfo {
  ticker: string;
  name: string;
  quote: string;
  currentPrice?: number;
}

interface AggregatedFill {
  externalId: string;
  coin: string;
  side: "buy" | "sell";
  time: number;
  grossQuantity: number;
  netQuantity: number;
  investedAmount: number;
  grossQuote: number;
  fee: number;
  feeToken?: string;
  hash: string;
}

export interface HypurrscanDcaLoadResult {
  entries: DcaEntry[];
  sourceUrl: string;
}

export function normalizeHyperliquidAddress(address: string): string | null {
  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

async function postInfo<T>(body: unknown, useUiApi = true): Promise<T> {
  const endpoints = useUiApi
    ? [HYPERLIQUID_UI_INFO_URL, HYPERLIQUID_INFO_URL]
    : [HYPERLIQUID_INFO_URL, HYPERLIQUID_UI_INFO_URL];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("Hyperliquid info API request failed");
}

async function fetchSpotMetaAndPrices(): Promise<{
  marketByName: Map<string, MarketInfo>;
}> {
  const [meta, contexts] = await postInfo<[SpotMeta, SpotAssetContext[]]>(
    { type: "spotMetaAndAssetCtxs" },
    false
  );
  const tokenByIndex = new Map(meta.tokens.map((token) => [token.index, token]));
  const ctxByCoin = new Map(contexts.map((ctx) => [ctx.coin, ctx] as const));
  const marketByName = new Map<string, MarketInfo>();

  for (const market of meta.universe) {
    const base = tokenByIndex.get(market.tokens[0]);
    const quote = tokenByIndex.get(market.tokens[1]);
    const ctx = ctxByCoin.get(market.name);
    const currentPrice = Number(ctx?.midPx ?? ctx?.markPx);

    marketByName.set(market.name, {
      ticker: base?.name ?? market.name,
      name: quote?.name ? `${base?.name ?? market.name}/${quote.name}` : base?.fullName ?? market.name,
      quote: quote?.name ?? "USDC",
      currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : undefined,
    });
  }

  return { marketByName };
}

async function fetchAllUserFills(address: string): Promise<HyperliquidFill[]> {
  const fills: HyperliquidFill[] = [];
  let startTime = 0;

  for (let page = 0; page < MAX_FILL_PAGES; page++) {
    const pageFills = await postInfo<HyperliquidFill[]>(
      {
        type: "userFillsByTime",
        user: address,
        aggregateByTime: true,
        startTime,
      },
      true
    );

    if (!Array.isArray(pageFills) || pageFills.length === 0) {
      break;
    }

    fills.push(...pageFills);

    if (pageFills.length < FILL_PAGE_LIMIT) {
      break;
    }

    startTime = Math.max(...pageFills.map((fill) => fill.time)) + 1;
  }

  if (fills.length > 0) {
    return fills;
  }

  const fallback = await postInfo<HyperliquidFill[]>(
    { type: "userFills", user: address },
    true
  );
  return Array.isArray(fallback) ? fallback : [];
}

function parseFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFillSide(fill: HyperliquidFill): "buy" | "sell" | null {
  if (fill.dir === "Buy" || fill.side === "B") return "buy";
  if (fill.dir === "Sell" || fill.side === "A") return "sell";
  return null;
}

function normalizeTokenName(token: string | null | undefined): string {
  return (token ?? "").trim().toUpperCase();
}

function isQuoteToken(token: string | null | undefined): boolean {
  return ["USDC", "USDT", "USD", "USDH", "USDE", "USDT0"].includes(
    normalizeTokenName(token)
  );
}

function getNetQuantity(params: {
  side: "buy" | "sell";
  grossQuantity: number;
  fee: number;
  feeToken?: string | null;
  baseToken: string;
}) {
  if (normalizeTokenName(params.feeToken) !== normalizeTokenName(params.baseToken)) {
    return params.grossQuantity;
  }

  return params.side === "buy"
    ? Math.max(params.grossQuantity - params.fee, 0)
    : params.grossQuantity + params.fee;
}

function getNetQuoteAmount(params: {
  side: "buy" | "sell";
  grossQuote: number;
  fee: number;
  feeToken?: string | null;
}) {
  if (!isQuoteToken(params.feeToken)) {
    return params.grossQuote;
  }

  return params.side === "buy"
    ? params.grossQuote + params.fee
    : Math.max(params.grossQuote - params.fee, 0);
}

function shanghaiDateFromMs(time: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function makeExternalId(fill: HyperliquidFill, side: "buy" | "sell") {
  return `${fill.hash}:${fill.coin}:${side}:${fill.time}`;
}

function makeDcaId(address: string, externalId: string) {
  const safeExternalId = externalId.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `hl_${address.slice(2, 10)}_${safeExternalId.slice(0, 96)}`;
}

function aggregateFills(
  fills: HyperliquidFill[],
  marketByName: Map<string, MarketInfo>
): AggregatedFill[] {
  const aggregateById = new Map<string, AggregatedFill>();

  for (const fill of fills) {
    const side = getFillSide(fill);
    const market = marketByName.get(fill.coin);
    const px = parseFiniteNumber(fill.px);
    const sz = parseFiniteNumber(fill.sz);

    if (!side || !market || px == null || px <= 0 || sz == null || sz <= 0) {
      continue;
    }

    const fee = Math.max(parseFiniteNumber(fill.fee) ?? 0, 0);
    const grossQuote = px * sz;
    const netQuantity = getNetQuantity({
      side,
      grossQuantity: sz,
      fee,
      feeToken: fill.feeToken,
      baseToken: market.ticker,
    });
    const investedAmount = getNetQuoteAmount({
      side,
      grossQuote,
      fee,
      feeToken: fill.feeToken,
    });
    const externalId = makeExternalId(fill, side);
    const current = aggregateById.get(externalId);

    if (current) {
      current.grossQuantity += sz;
      current.netQuantity += netQuantity;
      current.investedAmount += investedAmount;
      current.grossQuote += grossQuote;
      current.fee += fee;
      continue;
    }

    aggregateById.set(externalId, {
      externalId,
      coin: fill.coin,
      side,
      time: fill.time,
      grossQuantity: sz,
      netQuantity,
      investedAmount,
      grossQuote,
      fee,
      feeToken: fill.feeToken ?? undefined,
      hash: fill.hash,
    });
  }

  return Array.from(aggregateById.values()).sort((a, b) => b.time - a.time);
}

export async function loadHypurrscanDcaEntries(
  rawAddress: string
): Promise<HypurrscanDcaLoadResult> {
  const address = normalizeHyperliquidAddress(rawAddress);
  if (!address) {
    throw new Error("Invalid Hyperliquid address");
  }

  const [{ marketByName }, fills] = await Promise.all([
    fetchSpotMetaAndPrices(),
    fetchAllUserFills(address),
  ]);
  const now = new Date().toISOString();
  const entries = aggregateFills(fills, marketByName).map((fill) => {
    const market = marketByName.get(fill.coin);
    const quantity = Math.max(fill.netQuantity, 0);
    const investedAmount = Math.max(fill.investedAmount, 0);

    return {
      id: makeDcaId(address, fill.externalId),
      ticker: market?.ticker ?? fill.coin,
      name: market?.name,
      side: fill.side,
      assetClass: "crypto",
      currency: "USD",
      investedAt: shanghaiDateFromMs(fill.time),
      investedAmount,
      quantity,
      currentPrice: market?.currentPrice,
      quoteSymbol: market?.quote,
      quoteCurrency: "USD",
      priceUpdatedAt: market?.currentPrice ? now : undefined,
      source: "hyperliquid",
      sourceAddress: address,
      externalId: fill.externalId,
      sourceUpdatedAt: now,
      notes: `Hypurrscan ${fill.hash.slice(0, 10)}...${fill.hash.slice(-6)}`,
      createdAt: now,
      updatedAt: now,
    } satisfies DcaEntry;
  });

  return {
    entries: entries.filter(
      (entry) => entry.quantity > 0 && entry.investedAmount > 0
    ),
    sourceUrl: `${HYPURRSCAN_URL}/${address}#spot`,
  };
}
