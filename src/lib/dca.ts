import type { Currency, DcaAssetClass, DcaEntry, DcaEntrySide } from "@/types";

const DCA_EPSILON = 1e-8;

export interface DcaComputedEntry extends DcaEntry {
  side: DcaEntrySide;
  averagePrice: number;
  realisedPnl?: number;
  costBasisRemoved?: number;
  remainingQuantityAfter: number;
  remainingCostBasisAfter: number;
}

export interface DcaPositionSummary {
  key: string;
  ticker: string;
  name?: string;
  assetClass: DcaAssetClass;
  currency: Currency;
  quoteCurrency?: Currency;
  currentPrice?: number;
  totalBuyAmount: number;
  totalBuyQuantity: number;
  totalSellAmount: number;
  totalSellQuantity: number;
  remainingQuantity: number;
  remainingCostBasis: number;
  averageCost: number;
  marketValue: number;
  unrealizedPnl: number;
  realisedPnl: number;
  entriesCount: number;
  latestEntry: DcaEntry;
  latestBuyEntry?: DcaEntry;
  latestActivityAt: string;
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPrice(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

export function getDcaEntrySide(entry: Pick<DcaEntry, "side">): DcaEntrySide {
  return entry.side === "sell" ? "sell" : "buy";
}

function compareDcaEntries(a: DcaEntry, b: DcaEntry): number {
  if (a.investedAt !== b.investedAt) {
    return a.investedAt.localeCompare(b.investedAt);
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt.localeCompare(b.createdAt);
  }

  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt.localeCompare(b.updatedAt);
  }

  return a.id.localeCompare(b.id);
}

function isSameOrNewerEntry(candidate: DcaEntry, current: DcaEntry): boolean {
  return compareDcaEntries(candidate, current) >= 0;
}

function pickLatestPricedEntry(
  current: DcaEntry | undefined,
  candidate: DcaEntry
): DcaEntry | undefined {
  if (candidate.currentPrice == null || candidate.currentPrice <= 0) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  const candidatePriceTime = toTimestamp(candidate.priceUpdatedAt);
  const currentPriceTime = toTimestamp(current.priceUpdatedAt);

  if (candidatePriceTime !== currentPriceTime) {
    return candidatePriceTime >= currentPriceTime ? candidate : current;
  }

  return isSameOrNewerEntry(candidate, current) ? candidate : current;
}

export function buildDcaPositionSummaries(entries: DcaEntry[]): {
  positions: DcaPositionSummary[];
  computedEntries: DcaComputedEntry[];
} {
  const grouped = new Map<string, DcaEntry[]>();

  for (const entry of entries) {
    const key = `${entry.assetClass}:${entry.currency}:${entry.ticker}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }

  const positions: DcaPositionSummary[] = [];
  const computedEntries: DcaComputedEntry[] = [];

  for (const [key, groupedEntries] of grouped.entries()) {
    const sortedEntries = [...groupedEntries].sort(compareDcaEntries);
    const firstEntry = sortedEntries[0];
    let totalBuyAmount = 0;
    let totalBuyQuantity = 0;
    let totalSellAmount = 0;
    let totalSellQuantity = 0;
    let remainingQuantity = 0;
    let remainingCostBasis = 0;
    let realisedPnl = 0;
    let latestEntry = firstEntry;
    let latestBuyEntry: DcaEntry | undefined;
    let latestPricedEntry: DcaEntry | undefined;
    let name = firstEntry.name;

    for (const entry of sortedEntries) {
      const side = getDcaEntrySide(entry);
      const averagePrice = entry.quantity > 0 ? entry.investedAmount / entry.quantity : 0;
      let entryRealisedPnl: number | undefined;
      let costBasisRemoved: number | undefined;

      if (side === "buy") {
        totalBuyAmount += entry.investedAmount;
        totalBuyQuantity += entry.quantity;
        remainingQuantity += entry.quantity;
        remainingCostBasis += entry.investedAmount;
        latestBuyEntry = entry;
      } else {
        totalSellAmount += entry.investedAmount;
        totalSellQuantity += entry.quantity;

        const availableQuantity = Math.max(remainingQuantity, 0);
        const principalBeforeSell = Math.max(remainingCostBasis, 0);
        const quantityToReduce = Math.min(entry.quantity, availableQuantity);
        const remainingQuantityAfterSell = Math.max(0, availableQuantity - quantityToReduce);
        const closesPosition = remainingQuantityAfterSell <= DCA_EPSILON;

        if (closesPosition) {
          costBasisRemoved = principalBeforeSell;
          remainingQuantity = 0;
          remainingCostBasis = 0;
          entryRealisedPnl = entry.investedAmount - principalBeforeSell;
        } else {
          costBasisRemoved = Math.min(entry.investedAmount, principalBeforeSell);
          remainingQuantity = remainingQuantityAfterSell;
          remainingCostBasis = Math.max(0, principalBeforeSell - costBasisRemoved);
          entryRealisedPnl = Math.max(0, entry.investedAmount - principalBeforeSell);
        }

        realisedPnl += entryRealisedPnl;
      }

      if (entry.name) {
        name = entry.name;
      }

      if (isSameOrNewerEntry(entry, latestEntry)) {
        latestEntry = entry;
      }

      latestPricedEntry = pickLatestPricedEntry(latestPricedEntry, entry);

      computedEntries.push({
        ...entry,
        side,
        averagePrice: roundPrice(averagePrice),
        realisedPnl: entryRealisedPnl != null ? roundMoney(entryRealisedPnl) : undefined,
        costBasisRemoved: costBasisRemoved != null ? roundMoney(costBasisRemoved) : undefined,
        remainingQuantityAfter: roundQuantity(Math.max(remainingQuantity, 0)),
        remainingCostBasisAfter: roundMoney(Math.max(remainingCostBasis, 0)),
      });
    }

    const normalizedQuantity = roundQuantity(Math.max(remainingQuantity, 0));
    const normalizedCostBasis = roundMoney(Math.max(remainingCostBasis, 0));
    const currentPrice =
      latestPricedEntry?.currentPrice != null && latestPricedEntry.currentPrice > 0
        ? latestPricedEntry.currentPrice
        : undefined;
    const averageCost =
      normalizedQuantity > DCA_EPSILON ? normalizedCostBasis / normalizedQuantity : 0;
    const marketValue =
      currentPrice != null ? currentPrice * normalizedQuantity : normalizedCostBasis;
    const unrealizedPnl =
      currentPrice != null ? marketValue - normalizedCostBasis : 0;

    positions.push({
      key,
      ticker: firstEntry.ticker,
      name,
      assetClass: firstEntry.assetClass,
      currency: firstEntry.currency,
      quoteCurrency: latestPricedEntry?.quoteCurrency,
      currentPrice,
      totalBuyAmount: roundMoney(totalBuyAmount),
      totalBuyQuantity: roundQuantity(totalBuyQuantity),
      totalSellAmount: roundMoney(totalSellAmount),
      totalSellQuantity: roundQuantity(totalSellQuantity),
      remainingQuantity: normalizedQuantity,
      remainingCostBasis: normalizedCostBasis,
      averageCost: roundPrice(averageCost),
      marketValue: roundMoney(marketValue),
      unrealizedPnl: roundMoney(unrealizedPnl),
      realisedPnl: roundMoney(realisedPnl),
      entriesCount: sortedEntries.length,
      latestEntry,
      latestBuyEntry,
      latestActivityAt: latestEntry.investedAt,
    });
  }

  positions.sort((a, b) => {
    if (b.latestActivityAt !== a.latestActivityAt) {
      return b.latestActivityAt.localeCompare(a.latestActivityAt);
    }

    return a.ticker.localeCompare(b.ticker);
  });

  computedEntries.sort((a, b) => {
    if (b.investedAt !== a.investedAt) {
      return b.investedAt.localeCompare(a.investedAt);
    }

    if (b.createdAt !== a.createdAt) {
      return b.createdAt.localeCompare(a.createdAt);
    }

    return b.id.localeCompare(a.id);
  });

  return { positions, computedEntries };
}
