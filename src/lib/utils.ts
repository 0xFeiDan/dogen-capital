import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  currency = "USD",
  compact = false
): string {
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  if (compact && Math.abs(value) >= 1000) {
    options.notation = "compact";
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 1;
  }

  return new Intl.NumberFormat("en-US", options).format(value);
}

function getPriceFractionDigits(value: number): number {
  const abs = Math.abs(value);

  if (!Number.isFinite(abs) || abs === 0) {
    return 4;
  }

  if (abs >= 1) {
    return abs >= 1000 ? 2 : 4;
  }

  const leadingZeros = Math.max(0, Math.ceil(-Math.log10(abs)) - 1);
  return Math.min(12, Math.max(4, leadingZeros + 4));
}

export function formatPrice(value: number, currency = "USD"): string {
  const fractionDigits = getPriceFractionDigits(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  if (typeof date === "string" && !date.includes("T")) {
    return formatDate(date);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function toDateInputValue(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function toDateTimeInputValue(value?: string): string {
  if (!value) return "";
  if (value.includes("T")) return value.slice(0, 16);
  return `${value.slice(0, 10)}T00:00`;
}

export function normalizeDateTimeInputValue(value: string): string {
  if (!value) return "";
  if (value.includes("T")) return value.slice(0, 16);
  return `${value.slice(0, 10)}T00:00`;
}

export function getHoldingDurationMs(
  entryDate: string,
  exitDate?: string
): number | null {
  const start = new Date(entryDate).getTime();
  const end = exitDate ? new Date(exitDate).getTime() : Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return end - start;
}

export function formatHoldingDuration(durationMs: number | null): string {
  if (durationMs == null) return "--";

  const totalDays = durationMs / 86400000;
  const displayDays =
    totalDays >= 10 ? totalDays.toFixed(0) : totalDays.toFixed(1);

  return `${displayDays} 天`;
}

export function getPnlClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-text-secondary";
}
