import type { Currency, DcaAssetClass, DcaEntry } from "@/types";

export type DcaQuoteSource = "binance" | "bitget";

export interface DcaMarketQuote {
  assetClass: DcaAssetClass;
  symbol: string;
  price: number;
  currency: Currency;
  source: DcaQuoteSource;
  fetchedAt: string;
}

const FIAT_CURRENCIES = new Set<Currency>(["USD", "HKD", "CNY", "EUR", "GBP", "JPY"]);
const CRYPTO_QUOTE_BY_CURRENCY: Partial<Record<Currency, string>> = {
  USD: "USDT",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
};

export function isSupportedQuoteCurrency(value: string): value is Currency {
  return FIAT_CURRENCIES.has(value as Currency);
}

function normalizeCryptoSymbol(ticker: string, currency: Currency): string | null {
  const cleaned = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return null;

  if (
    cleaned.endsWith("USDT") ||
    cleaned.endsWith("USDC") ||
    cleaned.endsWith("BUSD") ||
    cleaned.endsWith("FDUSD")
  ) {
    return cleaned;
  }

  if (cleaned.endsWith("USD")) {
    return `${cleaned.slice(0, -3)}USDT`;
  }

  const quoteCurrency = CRYPTO_QUOTE_BY_CURRENCY[currency] ?? "USDT";
  return `${cleaned}${quoteCurrency}`;
}

function normalizeStockSymbol(ticker: string): string | null {
  const cleaned = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return null;

  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

export function getDcaQuoteSymbol(entry: Pick<DcaEntry, "ticker" | "assetClass" | "currency">) {
  if (entry.assetClass === "crypto") {
    return normalizeCryptoSymbol(entry.ticker, entry.currency);
  }

  return normalizeStockSymbol(entry.ticker);
}

export function getCryptoQuoteCurrency(symbol: string, fallback: Currency): Currency {
  const normalized = symbol.toUpperCase();

  if (
    normalized.endsWith("USDT") ||
    normalized.endsWith("USDC") ||
    normalized.endsWith("BUSD") ||
    normalized.endsWith("FDUSD") ||
    normalized.endsWith("USD")
  ) {
    return "USD";
  }

  if (normalized.endsWith("EUR")) return "EUR";
  if (normalized.endsWith("GBP")) return "GBP";
  if (normalized.endsWith("JPY")) return "JPY";

  return fallback;
}
