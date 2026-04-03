import type {
  BinanceMarketType,
  Trade,
  TradePricingMode,
} from "@/types";

export interface BinanceBookTickerQuote {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
}

export interface BinanceBookTickerSnapshot extends BinanceBookTickerQuote {
  marketType: BinanceMarketType;
}

export function getTradePricingMode(
  trade: Pick<Trade, "pricingMode">
): TradePricingMode {
  return trade.pricingMode === "binance" ? "binance" : "manual";
}

export function normalizeBinanceSymbol(value?: string | null): string | undefined {
  if (!value) return undefined;

  const symbol = value.trim().toUpperCase().replace(/[\s/_-]/g, "");
  return symbol || undefined;
}

export function suggestBinanceSymbol(value?: string | null): string {
  const normalized = normalizeBinanceSymbol(value) ?? "";
  if (!normalized) return "";

  const knownQuotes = ["USDT", "FDUSD", "USDC", "BTC", "ETH", "BNB"];
  if (knownQuotes.some((quote) => normalized.endsWith(quote))) {
    return normalized;
  }

  return `${normalized}USDT`;
}

export function normalizeBinanceMarketType(
  value?: BinanceMarketType | null
): BinanceMarketType | undefined {
  if (value === "spot" || value === "usdm-futures") {
    return value;
  }

  return undefined;
}

export function normalizeTrade(trade: Trade): Trade {
  const pricingMode = getTradePricingMode(trade);
  const binanceMarketType =
    pricingMode === "binance"
      ? normalizeBinanceMarketType(trade.binanceMarketType) ?? "spot"
      : undefined;
  const binanceSymbol =
    pricingMode === "binance"
      ? normalizeBinanceSymbol(trade.binanceSymbol)
      : undefined;

  return {
    ...trade,
    pricingMode,
    binanceMarketType,
    binanceSymbol,
  };
}

export function isBinancePricingEnabled(
  trade: Pick<Trade, "pricingMode" | "binanceMarketType" | "binanceSymbol">
): trade is Pick<Trade, "pricingMode" | "binanceMarketType" | "binanceSymbol"> & {
  pricingMode: "binance";
  binanceMarketType: BinanceMarketType;
  binanceSymbol: string;
} {
  return (
    getTradePricingMode(trade) === "binance" &&
    normalizeBinanceMarketType(trade.binanceMarketType) != null &&
    normalizeBinanceSymbol(trade.binanceSymbol) != null
  );
}

export function getTradeSettlementPrice(
  trade: Pick<Trade, "direction">,
  quote: BinanceBookTickerQuote
): number {
  return trade.direction === "short" ? quote.askPrice : quote.bidPrice;
}
