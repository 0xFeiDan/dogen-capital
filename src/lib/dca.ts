import type { DcaEntry, DcaTakeProfitMode } from "@/types";

type DcaTakeProfitConfig = Pick<
  DcaEntry,
  "takeProfitMode" | "takeProfitPrice" | "takeProfitPercent"
>;

function toPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function isDcaTakeProfitMode(value: unknown): value is DcaTakeProfitMode {
  return value === "price" || value === "percent";
}

export function normalizeDcaTakeProfit(
  config: DcaTakeProfitConfig
): DcaTakeProfitConfig {
  const price = toPositiveNumber(config.takeProfitPrice);
  const percent = toPositiveNumber(config.takeProfitPercent);

  if (config.takeProfitMode === "price" && price != null) {
    return {
      takeProfitMode: "price",
      takeProfitPrice: price,
      takeProfitPercent: undefined,
    };
  }

  if (config.takeProfitMode === "percent" && percent != null) {
    return {
      takeProfitMode: "percent",
      takeProfitPrice: undefined,
      takeProfitPercent: percent,
    };
  }

  if (price != null) {
    return {
      takeProfitMode: "price",
      takeProfitPrice: price,
      takeProfitPercent: undefined,
    };
  }

  if (percent != null) {
    return {
      takeProfitMode: "percent",
      takeProfitPrice: undefined,
      takeProfitPercent: percent,
    };
  }

  return {
    takeProfitMode: undefined,
    takeProfitPrice: undefined,
    takeProfitPercent: undefined,
  };
}

export function getDcaTakeProfitTargetPrice(
  config: DcaTakeProfitConfig,
  averageCost: number
): number | undefined {
  const normalized = normalizeDcaTakeProfit(config);

  if (normalized.takeProfitMode === "price") {
    return normalized.takeProfitPrice;
  }

  if (
    normalized.takeProfitMode === "percent" &&
    normalized.takeProfitPercent != null &&
    Number.isFinite(averageCost) &&
    averageCost > 0
  ) {
    return averageCost * (1 + normalized.takeProfitPercent / 100);
  }

  return undefined;
}
