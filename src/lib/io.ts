/**
 * io.ts — Import / Export utilities for trades and thoughts.
 *
 * All functions are pure (no side-effects, no DOM access) except
 * `triggerDownload` which requires a browser environment.
 */

import type {
  BinanceMarketType,
  DcaEntry,
  Trade,
  Thought,
  TradeDirection,
  TradePricingMode,
  TradeStatus,
  AssetClass,
  Currency,
  ThoughtCategory,
} from "@/types";
import { normalizeDcaTakeProfit } from "@/lib/dca";
import { normalizeBinanceSymbol, normalizeTrade } from "@/lib/pricing";

const DCA_ASSET_CLASSES = ["stock", "crypto"] as const;
const CURRENCIES: Currency[] = [
  "USD","HKD","CNY","EUR","GBP","JPY","BTC","ETH",
];

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ParseResult<T> {
  data: T[];
  errors: string[];
}

function parseFiniteNumber(value: unknown): number | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : null;

  return num != null && Number.isFinite(num) ? num : null;
}

function parseOptionalFiniteNumber(value: unknown): number | undefined | null {
  if (value == null || value === "") return undefined;
  const num = parseFiniteNumber(value);
  return num == null ? null : num;
}

function isIsoLikeDate(value: string): boolean {
  return value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

// ─── Browser download ─────────────────────────────────────────────────────────

export function triggerDownload(
  content: string,
  filename: string,
  mime: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── JSON export ──────────────────────────────────────────────────────────────

export function tradesToJSON(trades: Trade[]): string {
  return JSON.stringify({ version: 1, type: "trades", data: trades }, null, 2);
}

export function thoughtsToJSON(thoughts: Thought[]): string {
  return JSON.stringify(
    { version: 1, type: "thoughts", data: thoughts },
    null,
    2
  );
}

export function dcaEntriesToJSON(entries: DcaEntry[]): string {
  return JSON.stringify({ version: 1, type: "dca", data: entries }, null, 2);
}

// ─── JSON import ──────────────────────────────────────────────────────────────

export function jsonToTrades(text: string): ParseResult<Trade> {
  const errors: string[] = [];
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return { data: [], errors: ["Invalid JSON: could not parse file"] };
  }

  // Accept both { data: [...] } wrapper and bare array
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
    ? ((raw as Record<string, unknown>).data as unknown[])
    : [];

  if (arr.length === 0 && !Array.isArray(raw)) {
    return { data: [], errors: ["JSON must contain an array of trade objects"] };
  }

  const data: Trade[] = [];
  arr.forEach((item, i) => {
    const { trade, error } = validateTradeObject(item, i + 1);
    if (error) errors.push(error);
    if (trade) data.push(trade);
  });

  return { data, errors };
}

export function jsonToThoughts(text: string): ParseResult<Thought> {
  const errors: string[] = [];
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return { data: [], errors: ["Invalid JSON: could not parse file"] };
  }

  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
    ? ((raw as Record<string, unknown>).data as unknown[])
    : [];

  if (arr.length === 0 && !Array.isArray(raw)) {
    return {
      data: [],
      errors: ["JSON must contain an array of thought objects"],
    };
  }

  const data: Thought[] = [];
  arr.forEach((item, i) => {
    const { thought, error } = validateThoughtObject(item, i + 1);
    if (error) errors.push(error);
    if (thought) data.push(thought);
  });

  return { data, errors };
}

export function jsonToDcaEntries(text: string): ParseResult<DcaEntry> {
  const errors: string[] = [];
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return { data: [], errors: ["Invalid JSON: could not parse file"] };
  }

  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
    ? ((raw as Record<string, unknown>).data as unknown[])
    : [];

  if (arr.length === 0 && !Array.isArray(raw)) {
    return { data: [], errors: ["JSON must contain an array of DCA objects"] };
  }

  const data: DcaEntry[] = [];
  arr.forEach((item, i) => {
    const { entry, error } = validateDcaObject(item, i + 1);
    if (error) errors.push(error);
    if (entry) data.push(entry);
  });

  return { data, errors };
}

// ─── CSV headers ──────────────────────────────────────────────────────────────

export const TRADE_CSV_HEADERS = [
  "id",
  "ticker",
  "name",
  "pricingMode",
  "binanceMarketType",
  "binanceSymbol",
  "direction",
  "status",
  "assetClass",
  "currency",
  "entryDate",
  "exitDate",
  "entryPrice",
  "exitPrice",
  "currentPrice",
  "quantity",
  "fees",
  "setupType",
  "tags",
  "notes",
  "createdAt",
  "updatedAt",
] as const;

// ─── CSV export ───────────────────────────────────────────────────────────────

function csvCell(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tradesToCSV(trades: Trade[]): string {
  const header = TRADE_CSV_HEADERS.join(",");
  const rows = trades.map((t) => {
    const fields: string[] = [
      t.id,
      t.ticker,
      t.name ?? "",
      t.pricingMode ?? "manual",
      t.binanceMarketType ?? "",
      t.binanceSymbol ?? "",
      t.direction,
      t.status,
      t.assetClass,
      t.currency,
      t.entryDate,
      t.exitDate ?? "",
      t.entryPrice.toString(),
      t.exitPrice?.toString() ?? "",
      t.currentPrice?.toString() ?? "",
      t.quantity.toString(),
      t.fees.toString(),
      t.setupType ?? "",
      t.tags.join("|"),
      t.notes ?? "",
      t.createdAt,
      t.updatedAt,
    ];
    return fields.map(csvCell).join(",");
  });
  return [header, ...rows].join("\r\n");
}

// ─── CSV import ───────────────────────────────────────────────────────────────

/** Full RFC 4180 CSV parser — handles quoted fields with embedded commas/newlines. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i <= src.length; i++) {
    const ch = src[i];

    if (i === src.length) {
      fields.push(field);
      if (fields.some((f) => f !== "")) rows.push([...fields]);
      break;
    }

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else if (ch === "\n") {
        fields.push(field);
        field = "";
        if (fields.some((f) => f !== "")) rows.push([...fields]);
        fields.length = 0;
      } else {
        field += ch;
      }
    }
  }

  return rows;
}

export function csvToTrades(text: string): ParseResult<Trade> {
  const rows = parseCSV(text.trim());
  if (rows.length < 2) {
    return { data: [], errors: ["CSV file appears empty or has no data rows"] };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const errors: string[] = [];
  const data: Trade[] = [];

  // Build column index map (case-insensitive)
  const col = (name: string): number =>
    headers.indexOf(name.toLowerCase());

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (name: string): string =>
      (row[col(name)] ?? "").trim();

    const ticker = get("ticker");
    const direction = get("direction");
    const status = get("status");
    const pricingModeRaw = get("pricingMode") || get("pricingmode");
    const pricingMode: TradePricingMode =
      pricingModeRaw === "binance" ? "binance" : "manual";
    const binanceMarketTypeRaw =
      get("binanceMarketType") || get("binancemarkettype");
    const binanceSymbolRaw = get("binanceSymbol") || get("binancesymbol");

    if (!ticker) {
      errors.push(`Row ${r + 1}: missing ticker — skipped`);
      continue;
    }

    const DIRECTIONS: TradeDirection[] = ["long", "short"];
    const STATUSES: TradeStatus[] = ["open", "closed"];

    if (!DIRECTIONS.includes(direction as TradeDirection)) {
      errors.push(
        `Row ${r + 1} (${ticker}): invalid direction "${direction}" — skipped`
      );
      continue;
    }
    if (!STATUSES.includes(status as TradeStatus)) {
      errors.push(
        `Row ${r + 1} (${ticker}): invalid status "${status}" — skipped`
      );
      continue;
    }

    const ASSET_CLASSES: AssetClass[] = [
      "stock","etf","crypto","forex","futures","option","other",
    ];
    const CURRENCIES: Currency[] = [
      "USD","HKD","CNY","EUR","GBP","JPY","BTC","ETH",
    ];

    const assetClassRaw = get("assetClass") || get("assetclass");
    const currencyRaw = get("currency");

    const entryPrice = parseOptionalFiniteNumber(get("entryPrice") || get("entryprice"));
    const exitPrice = parseOptionalFiniteNumber(get("exitPrice") || get("exitprice"));
    const currentPrice = parseOptionalFiniteNumber(get("currentPrice") || get("currentprice"));
    const quantity = parseOptionalFiniteNumber(get("quantity"));
    const fees = parseOptionalFiniteNumber(get("fees"));
    const entryDate = get("entryDate") || get("entrydate") || new Date().toISOString().slice(0, 10);
    const exitDate = get("exitDate") || get("exitdate") || undefined;

    if (entryPrice == null || entryPrice <= 0) {
      errors.push(`Row ${r + 1} (${ticker}): invalid entryPrice - skipped`);
      continue;
    }
    if (quantity == null || quantity <= 0) {
      errors.push(`Row ${r + 1} (${ticker}): invalid quantity - skipped`);
      continue;
    }
    if (fees == null || fees < 0) {
      errors.push(`Row ${r + 1} (${ticker}): invalid fees - skipped`);
      continue;
    }
    if (!isIsoLikeDate(entryDate)) {
      errors.push(`Row ${r + 1} (${ticker}): invalid entryDate - skipped`);
      continue;
    }
    if (status === "closed") {
      if (!exitDate || !isIsoLikeDate(exitDate)) {
        errors.push(`Row ${r + 1} (${ticker}): invalid exitDate - skipped`);
        continue;
      }
      if (exitPrice == null || exitPrice <= 0) {
        errors.push(`Row ${r + 1} (${ticker}): invalid exitPrice - skipped`);
        continue;
      }
    }

    const trade = normalizeTrade({
      id: get("id") || `imp_${Date.now()}_${r}`,
      ticker,
      name: get("name") || undefined,
      pricingMode,
      binanceMarketType:
        pricingMode === "binance" &&
        (binanceMarketTypeRaw === "spot" ||
          binanceMarketTypeRaw === "usdm-futures")
          ? (binanceMarketTypeRaw as BinanceMarketType)
          : pricingMode === "binance"
          ? "spot"
          : undefined,
      binanceSymbol:
        pricingMode === "binance"
          ? normalizeBinanceSymbol(binanceSymbolRaw)
          : undefined,
      direction: direction as TradeDirection,
      status: status as TradeStatus,
      assetClass: (ASSET_CLASSES.includes(assetClassRaw as AssetClass)
        ? assetClassRaw
        : "other") as AssetClass,
      currency: (CURRENCIES.includes(currencyRaw as Currency)
        ? currencyRaw
        : "USD") as Currency,
      entryDate,
      exitDate,
      entryPrice,
      exitPrice: status === "closed" ? exitPrice ?? undefined : undefined,
      currentPrice: status === "open" ? currentPrice ?? undefined : undefined,
      quantity,
      fees,
      setupType: get("setupType") || get("setuptype") || undefined,
      tags: (get("tags") || "")
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: get("notes") || undefined,
      createdAt:
        get("createdAt") || get("createdat") || new Date().toISOString(),
      updatedAt:
        get("updatedAt") || get("updatedat") || new Date().toISOString(),
    });

    // Clean up undefined optional fields
    if (trade.exitDate == null) delete trade.exitDate;
    if (trade.exitPrice == null) delete trade.exitPrice;
    if (trade.currentPrice == null) delete trade.currentPrice;
    if (!trade.setupType) delete trade.setupType;
    if (!trade.name) delete trade.name;
    if (!trade.notes) delete trade.notes;

    data.push(trade);
  }

  return { data, errors };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateTradeObject(
  obj: unknown,
  rowNum: number
): { trade: Trade | null; error: string | null } {
  if (typeof obj !== "object" || obj === null) {
    return { trade: null, error: `Item ${rowNum}: not an object — skipped` };
  }

  const o = obj as Record<string, unknown>;
  const ticker = String(o.ticker ?? "").trim();
  const direction = String(o.direction ?? "").trim();
  const status = String(o.status ?? "").trim();
  const pricingModeRaw = String(o.pricingMode ?? "manual").trim();
  const pricingMode: TradePricingMode =
    pricingModeRaw === "binance" ? "binance" : "manual";
  const binanceMarketTypeRaw = String(o.binanceMarketType ?? "").trim();
  const binanceSymbol = normalizeBinanceSymbol(
    o.binanceSymbol ? String(o.binanceSymbol) : undefined
  );

  if (!ticker) {
    return {
      trade: null,
      error: `Item ${rowNum}: missing ticker — skipped`,
    };
  }

  const DIRECTIONS: TradeDirection[] = ["long", "short"];
  const STATUSES: TradeStatus[] = ["open", "closed"];

  if (!DIRECTIONS.includes(direction as TradeDirection)) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid direction "${direction}" — skipped`,
    };
  }
  if (!STATUSES.includes(status as TradeStatus)) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid status "${status}" — skipped`,
    };
  }

  const ASSET_CLASSES: AssetClass[] = [
    "stock","etf","crypto","forex","futures","option","other",
  ];
  const CURRENCIES: Currency[] = [
    "USD","HKD","CNY","EUR","GBP","JPY","BTC","ETH",
  ];

  const assetClassRaw = String(o.assetClass ?? "other");
  const currencyRaw = String(o.currency ?? "USD");
  const tagsRaw = Array.isArray(o.tags) ? (o.tags as string[]) : [];

  const entryPrice = parseFiniteNumber(o.entryPrice);
  const quantity = parseFiniteNumber(o.quantity);
  const fees = parseFiniteNumber(o.fees ?? 0);
  const exitPrice = parseOptionalFiniteNumber(o.exitPrice);
  const currentPrice = parseOptionalFiniteNumber(o.currentPrice);
  const entryDate = String(o.entryDate ?? "");
  const exitDate = o.exitDate ? String(o.exitDate) : undefined;

  if (entryPrice == null || entryPrice <= 0) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid entryPrice - skipped`,
    };
  }

  if (quantity == null || quantity <= 0) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid quantity - skipped`,
    };
  }

  if (fees == null || fees < 0) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid fees - skipped`,
    };
  }

  if (!isIsoLikeDate(entryDate)) {
    return {
      trade: null,
      error: `Item ${rowNum} (${ticker}): invalid entryDate - skipped`,
    };
  }

  if (status === "closed") {
    if (!exitDate || !isIsoLikeDate(exitDate)) {
      return {
        trade: null,
        error: `Item ${rowNum} (${ticker}): invalid exitDate - skipped`,
      };
    }
    if (exitPrice == null || exitPrice <= 0) {
      return {
        trade: null,
        error: `Item ${rowNum} (${ticker}): invalid exitPrice - skipped`,
      };
    }
  }

  const trade = normalizeTrade({
    id: String(o.id ?? `imp_${Date.now()}_${rowNum}`),
    ticker,
    name: o.name ? String(o.name) : undefined,
    pricingMode,
    binanceMarketType:
      pricingMode === "binance" &&
      (binanceMarketTypeRaw === "spot" ||
        binanceMarketTypeRaw === "usdm-futures")
        ? (binanceMarketTypeRaw as BinanceMarketType)
        : pricingMode === "binance"
        ? "spot"
        : undefined,
    binanceSymbol: pricingMode === "binance" ? binanceSymbol : undefined,
    direction: direction as TradeDirection,
    status: status as TradeStatus,
    assetClass: (ASSET_CLASSES.includes(assetClassRaw as AssetClass)
      ? assetClassRaw
      : "other") as AssetClass,
    currency: (CURRENCIES.includes(currencyRaw as Currency)
      ? currencyRaw
      : "USD") as Currency,
    entryDate,
    exitDate,
    entryPrice,
    exitPrice: status === "closed" ? exitPrice ?? undefined : undefined,
    currentPrice: status === "open" ? currentPrice ?? undefined : undefined,
    quantity,
    fees,
    setupType: o.setupType ? String(o.setupType) : undefined,
    tags: tagsRaw.map(String),
    notes: o.notes ? String(o.notes) : undefined,
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  });

  return { trade, error: null };
}

function validateThoughtObject(
  obj: unknown,
  rowNum: number
): { thought: Thought | null; error: string | null } {
  if (typeof obj !== "object" || obj === null) {
    return { thought: null, error: `Item ${rowNum}: not an object — skipped` };
  }

  const o = obj as Record<string, unknown>;
  const title = String(o.title ?? "").trim();

  if (!title) {
    return {
      thought: null,
      error: `Item ${rowNum}: missing title — skipped`,
    };
  }

  const CATEGORIES: ThoughtCategory[] = [
    "macro","sector","stock","strategy","review","other",
  ];
  const categoryRaw = String(o.category ?? "other");
  const tagsRaw = Array.isArray(o.tags) ? (o.tags as string[]) : [];

  const thought: Thought = {
    id: String(o.id ?? `imp_${Date.now()}_${rowNum}`),
    title,
    content: String(o.content ?? ""),
    category: (CATEGORIES.includes(categoryRaw as ThoughtCategory)
      ? categoryRaw
      : "other") as ThoughtCategory,
    tags: tagsRaw.map(String),
    ticker: o.ticker ? String(o.ticker) : undefined,
    isPrivate: Boolean(o.isPrivate),
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  };

  return { thought, error: null };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function validateDcaObject(
  obj: unknown,
  rowNum: number
): { entry: DcaEntry | null; error: string | null } {
  if (typeof obj !== "object" || obj === null) {
    return { entry: null, error: `Item ${rowNum}: not an object - skipped` };
  }

  const o = obj as Record<string, unknown>;
  const ticker = String(o.ticker ?? "").trim().toUpperCase();
  const assetClass = String(o.assetClass ?? "stock").trim();
  const currency = String(o.currency ?? "USD").trim().toUpperCase();
  const investedAt = String(o.investedAt ?? "").trim();
  const investedAmount = parseFiniteNumber(o.investedAmount);
  const quantity = parseFiniteNumber(o.quantity);
  const currentPrice = parseOptionalFiniteNumber(o.currentPrice);
  const takeProfit = normalizeDcaTakeProfit({
    takeProfitMode:
      o.takeProfitMode === "price" || o.takeProfitMode === "percent"
        ? o.takeProfitMode
        : undefined,
    takeProfitPrice: parseOptionalFiniteNumber(o.takeProfitPrice) ?? undefined,
    takeProfitPercent: parseOptionalFiniteNumber(o.takeProfitPercent) ?? undefined,
  });

  if (!ticker) {
    return { entry: null, error: `Item ${rowNum}: missing ticker - skipped` };
  }

  if (!DCA_ASSET_CLASSES.includes(assetClass as DcaEntry["assetClass"])) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid assetClass - skipped` };
  }

  if (!CURRENCIES.includes(currency as Currency)) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid currency - skipped` };
  }

  if (!isIsoLikeDate(investedAt)) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid investedAt - skipped` };
  }

  if (investedAmount == null || investedAmount <= 0) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid investedAmount - skipped` };
  }

  if (quantity == null || quantity <= 0) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid quantity - skipped` };
  }

  if (currentPrice === null || (typeof currentPrice === "number" && currentPrice <= 0)) {
    return { entry: null, error: `Item ${rowNum} (${ticker}): invalid currentPrice - skipped` };
  }

  const quoteCurrency = String(o.quoteCurrency ?? "").trim().toUpperCase();

  return {
    entry: {
      id: String(o.id ?? `dca_imp_${Date.now()}_${rowNum}`),
      ticker,
      name: o.name ? String(o.name).trim() : undefined,
      assetClass: assetClass as DcaEntry["assetClass"],
      currency: currency as Currency,
      investedAt,
      investedAmount,
      quantity,
      currentPrice: currentPrice ?? undefined,
      quoteSymbol: o.quoteSymbol ? String(o.quoteSymbol).trim().toUpperCase() : undefined,
      quoteCurrency: CURRENCIES.includes(quoteCurrency as Currency)
        ? (quoteCurrency as Currency)
        : undefined,
      priceUpdatedAt: o.priceUpdatedAt ? String(o.priceUpdatedAt) : undefined,
      takeProfitMode: takeProfit.takeProfitMode,
      takeProfitPrice: takeProfit.takeProfitPrice,
      takeProfitPercent: takeProfit.takeProfitPercent,
      notes: o.notes ? String(o.notes) : undefined,
      createdAt: String(o.createdAt ?? new Date().toISOString()),
      updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    },
    error: null,
  };
}

/** Returns today's date as YYYYMMDD for filenames. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
