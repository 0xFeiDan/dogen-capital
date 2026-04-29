import type { Currency, DcaEntry, Thought, Trade } from "@/types";

const CURRENCIES: Currency[] = ["USD", "HKD", "CNY", "EUR", "GBP", "JPY", "BTC", "ETH"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency);
}

export function isOptionalPositiveNumber(value: unknown): value is number | undefined {
  return value == null || isPositiveNumber(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isValidTrade(value: unknown): value is Trade {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.ticker) &&
    (value.pricingMode == null || value.pricingMode === "manual" || value.pricingMode === "binance") &&
    (value.binanceMarketType == null ||
      value.binanceMarketType === "spot" ||
      value.binanceMarketType === "usdm-futures") &&
    (value.binanceSymbol == null || typeof value.binanceSymbol === "string") &&
    (value.direction === "long" || value.direction === "short") &&
    (value.status === "open" || value.status === "closed") &&
    isNonEmptyString(value.assetClass) &&
    isCurrency(value.currency) &&
    isNonEmptyString(value.entryDate) &&
    (value.exitDate == null || typeof value.exitDate === "string") &&
    isPositiveNumber(value.entryPrice) &&
    (value.exitPrice == null || isPositiveNumber(value.exitPrice)) &&
    isPositiveNumber(value.quantity) &&
    isNonNegativeNumber(value.fees) &&
    isOptionalPositiveNumber(value.currentPrice) &&
    isStringArray(value.tags) &&
    (value.name == null || typeof value.name === "string") &&
    (value.notes == null || typeof value.notes === "string") &&
    (value.setupType == null || typeof value.setupType === "string") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isValidThought(value: unknown): value is Thought {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.content === "string" &&
    ["macro", "sector", "stock", "strategy", "review", "other"].includes(
      String(value.category)
    ) &&
    isStringArray(value.tags) &&
    (value.ticker == null || typeof value.ticker === "string") &&
    (value.isPrivate == null || typeof value.isPrivate === "boolean") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isValidDcaEntry(value: unknown): value is DcaEntry {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.ticker) &&
    (value.name == null || typeof value.name === "string") &&
    (value.side == null || value.side === "buy" || value.side === "sell") &&
    (value.assetClass === "stock" || value.assetClass === "crypto") &&
    isCurrency(value.currency) &&
    isNonEmptyString(value.investedAt) &&
    isPositiveNumber(value.investedAmount) &&
    isPositiveNumber(value.quantity) &&
    isOptionalPositiveNumber(value.currentPrice) &&
    (value.quoteSymbol == null || typeof value.quoteSymbol === "string") &&
    (value.quoteCurrency == null || isCurrency(value.quoteCurrency)) &&
    (value.priceUpdatedAt == null || typeof value.priceUpdatedAt === "string") &&
    (value.source == null || value.source === "hyperliquid") &&
    (value.sourceAddress == null || typeof value.sourceAddress === "string") &&
    (value.externalId == null || typeof value.externalId === "string") &&
    (value.sourceUpdatedAt == null || typeof value.sourceUpdatedAt === "string") &&
    (value.notes == null || typeof value.notes === "string") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isValidLivePriceUpdate(
  value: unknown
): value is { id: string; currentPrice: number } {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPositiveNumber(value.currentPrice)
  );
}

export function isValidDcaLivePriceUpdate(value: unknown): value is {
  id: string;
  currentPrice: number;
  quoteSymbol?: string;
  quoteCurrency?: Currency;
  priceUpdatedAt?: string;
} {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPositiveNumber(value.currentPrice) &&
    (value.quoteSymbol == null || typeof value.quoteSymbol === "string") &&
    (value.quoteCurrency == null || isCurrency(value.quoteCurrency)) &&
    (value.priceUpdatedAt == null || typeof value.priceUpdatedAt === "string")
  );
}
