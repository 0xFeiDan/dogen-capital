// ─── Primitives ───────────────────────────────────────────────────────────────

export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradePricingMode = "manual" | "binance";
export type BinanceMarketType = "spot" | "usdm-futures";
export type DcaAssetClass = "stock" | "crypto";
export type AssetClass =
  | "stock"
  | "etf"
  | "crypto"
  | "forex"
  | "futures"
  | "option"
  | "other";
export type Currency = "USD" | "HKD" | "CNY" | "EUR" | "GBP" | "JPY" | "BTC" | "ETH";
export type ThoughtCategory =
  | "macro"
  | "sector"
  | "stock"
  | "strategy"
  | "review"
  | "other";

// ─── Trade ────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  ticker: string;
  name?: string;
  pricingMode?: TradePricingMode;
  binanceMarketType?: BinanceMarketType;
  binanceSymbol?: string;
  direction: TradeDirection;
  status: TradeStatus;
  assetClass: AssetClass;
  currency: Currency;
  entryDate: string;          // ISO date or datetime string
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  fees: number;               // Always present, default 0
  currentPrice?: number;      // For open trades: track current market price
  tags: string[];
  notes?: string;
  setupType?: string;
  createdAt: string;          // ISO datetime
  updatedAt: string;
}

/** Computed result – not stored, derived on the fly */
export interface TradePnL {
  gross: number;      // before fees
  net: number;        // after fees
  percent: number;    // net / (entryPrice * quantity) * 100
  isWin: boolean;
}

// ─── Thought / Note ───────────────────────────────────────────────────────────

export interface Thought {
  id: string;
  title: string;
  content: string;
  category: ThoughtCategory;
  tags: string[];
  ticker?: string;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DcaEntry {
  id: string;
  ticker: string;
  name?: string;
  assetClass: DcaAssetClass;
  currency: Currency;
  investedAt: string;
  investedAmount: number;
  quantity: number;
  currentPrice?: number;
  quoteSymbol?: string;
  quoteCurrency?: Currency;
  priceUpdatedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Portfolio stats (derived) ────────���───────────────────────────────────────

export interface PortfolioStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;          // 0–100
  realisedNetPnl: number;
  unrealisedNetPnl: number;
  combinedNetPnl: number;
  totalNetPnl: number;
  totalGrossPnl: number;
  tradeUnrealisedNetPnl: number;
  dcaUnrealisedNetPnl: number;
  dcaMarketValue: number;
  dcaInvested: number;
  dcaPositions: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  profitFactor: number;     // total wins / total losses (absolute)
  expectancy: number;       // avg PnL per trade
  deployedCapital: number;  // sum of entryPrice*qty for open positions
  totalInvested: number;    // sum of entryPrice*qty for all closed positions
  pnlPercent: number;       // totalNetPnl / totalInvested * 100
}

/** One data point for the equity curve chart */
export interface EquityPoint {
  date: string;
  cumPnl: number;
  nav: number;
  trades: number;
}

/** Aggregated monthly PnL */
export interface MonthlyPnl {
  month: string;   // "YYYY-MM"
  label: string;   // "Jan 25"
  pnl: number;
  trades: number;
}

/** Asset class breakdown slice */
export interface AssetBreakdown {
  assetClass: AssetClass;
  count: number;
  pnl: number;
  pnlPercent: number;   // share of total absolute PnL
}

export interface PortfolioAllocation {
  key: string;
  label: string;
  value: number;
  percent: number;
  count?: number;
}

// ─── Recent activity (union) ──────────────────────────────────────────────────

export type ActivityItem =
  | { kind: "trade"; date: string; item: Trade }
  | { kind: "thought"; date: string; item: Thought };

// ─── Analytics (derived) ──────────────────────────────────────────────────────

/** Win/loss/PnL breakdown per tag (closed trades only) */
export interface TagStats {
  tag: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;    // 0–100
  totalPnl: number;
  avgPnl: number;
}

/** One bucket in the holding-duration histogram */
export interface DurationBucket {
  label: string;
  minDays: number;
  maxDays: number;
  count: number;
}
