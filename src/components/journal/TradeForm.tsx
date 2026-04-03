"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import {
  getTradePricingMode,
  normalizeBinanceSymbol,
  suggestBinanceSymbol,
} from "@/lib/pricing";
import {
  cn,
  formatCurrency,
  normalizeDateTimeInputValue,
  toDateTimeInputValue,
} from "@/lib/utils";
import type {
  AssetClass,
  BinanceMarketType,
  Currency,
  Trade,
  TradeDirection,
  TradePricingMode,
  TradeStatus,
} from "@/types";

export interface TradeFormState {
  ticker: string;
  name: string;
  pricingMode: TradePricingMode;
  binanceMarketType: BinanceMarketType;
  binanceSymbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  status: TradeStatus;
  currency: Currency;
  entryDate: string;
  exitDate: string;
  entryPrice: string;
  exitPrice: string;
  currentPrice: string;
  quantity: string;
  fees: string;
  setupType: string;
  tags: string[];
  notes: string;
}

export interface TradeFormErrors {
  ticker?: string;
  entryDate?: string;
  entryPrice?: string;
  quantity?: string;
  exitDate?: string;
  exitPrice?: string;
  currentPrice?: string;
  binanceSymbol?: string;
}

export const EMPTY_FORM: TradeFormState = {
  ticker: "",
  name: "",
  pricingMode: "manual",
  binanceMarketType: "spot",
  binanceSymbol: "",
  assetClass: "stock",
  direction: "long",
  status: "closed",
  currency: "USD",
  entryDate: "",
  exitDate: "",
  entryPrice: "",
  exitPrice: "",
  currentPrice: "",
  quantity: "",
  fees: "0",
  setupType: "",
  tags: [],
  notes: "",
};

export function tradeToForm(trade: Trade): TradeFormState {
  return {
    ticker: trade.ticker,
    name: trade.name ?? "",
    pricingMode: getTradePricingMode(trade),
    binanceMarketType: trade.binanceMarketType ?? "spot",
    binanceSymbol: trade.binanceSymbol ?? "",
    assetClass: trade.assetClass,
    direction: trade.direction,
    status: trade.status,
    currency: trade.currency,
    entryDate: toDateTimeInputValue(trade.entryDate),
    exitDate: toDateTimeInputValue(trade.exitDate),
    entryPrice: String(trade.entryPrice),
    exitPrice: String(trade.exitPrice ?? ""),
    currentPrice: String(trade.currentPrice ?? ""),
    quantity: String(trade.quantity),
    fees: String(trade.fees),
    setupType: trade.setupType ?? "",
    tags: trade.tags,
    notes: trade.notes ?? "",
  };
}

export function formToTrade(
  form: TradeFormState
): Omit<Trade, "id" | "createdAt" | "updatedAt"> {
  const entryPrice = parseFloat(form.entryPrice);
  const exitPrice = parseFloat(form.exitPrice);
  const currentPrice = parseFloat(form.currentPrice);
  const pricingMode = form.pricingMode;
  const binanceSymbol = normalizeBinanceSymbol(form.binanceSymbol);

  return {
    ticker: form.ticker.trim().toUpperCase(),
    name: form.name.trim() || undefined,
    pricingMode,
    binanceMarketType:
      pricingMode === "binance" ? form.binanceMarketType : undefined,
    binanceSymbol: pricingMode === "binance" ? binanceSymbol : undefined,
    assetClass: form.assetClass,
    direction: form.direction,
    status: form.status,
    currency: form.currency,
    entryDate: normalizeDateTimeInputValue(form.entryDate),
    exitDate:
      form.status === "closed" && form.exitDate
        ? normalizeDateTimeInputValue(form.exitDate)
        : undefined,
    entryPrice,
    exitPrice:
      form.status === "closed" && !Number.isNaN(exitPrice) ? exitPrice : undefined,
    currentPrice:
      form.status === "open" &&
      !Number.isNaN(currentPrice) &&
      currentPrice > 0
        ? currentPrice
        : undefined,
    quantity: parseFloat(form.quantity),
    fees: parseFloat(form.fees) || 0,
    setupType: form.setupType.trim() || undefined,
    tags: form.tags,
    notes: form.notes.trim() || undefined,
  };
}

function validate(form: TradeFormState): TradeFormErrors {
  const errors: TradeFormErrors = {};

  if (!form.ticker.trim()) errors.ticker = "必填";
  if (!form.entryDate) errors.entryDate = "必填";

  const entryPrice = parseFloat(form.entryPrice);
  if (Number.isNaN(entryPrice) || entryPrice <= 0) {
    errors.entryPrice = "必须大于 0";
  }

  const quantity = parseFloat(form.quantity);
  if (Number.isNaN(quantity) || quantity <= 0) {
    errors.quantity = "必须大于 0";
  }

  if (form.pricingMode === "binance") {
    if (!normalizeBinanceSymbol(form.binanceSymbol)) {
      errors.binanceSymbol = "请输入币安代码";
    }
  }

  if (form.status === "open" && form.pricingMode === "manual" && form.currentPrice) {
    const currentPrice = parseFloat(form.currentPrice);
    if (Number.isNaN(currentPrice) || currentPrice <= 0) {
      errors.currentPrice = "当前价格必须大于 0";
    }
  }

  if (form.status === "closed") {
    if (!form.exitDate) errors.exitDate = "已平仓交易必须填写出场时间";

    const exitPrice = parseFloat(form.exitPrice);
    if (Number.isNaN(exitPrice) || exitPrice <= 0) {
      errors.exitPrice = "必须大于 0";
    }

    if (
      form.entryDate &&
      form.exitDate &&
      new Date(form.exitDate).getTime() < new Date(form.entryDate).getTime()
    ) {
      errors.exitDate = "出场时间不能早于入场时间";
    }
  }

  return errors;
}

function PnLPreview({ form }: { form: TradeFormState }) {
  const entryPrice = parseFloat(form.entryPrice);
  const quantity = parseFloat(form.quantity);
  const fees = parseFloat(form.fees) || 0;
  const isShort = form.direction === "short";

  if (
    Number.isNaN(entryPrice) ||
    entryPrice <= 0 ||
    Number.isNaN(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  const comparePriceString =
    form.status === "closed" ? form.exitPrice : form.currentPrice;
  const comparePrice = parseFloat(comparePriceString);

  if (Number.isNaN(comparePrice) || comparePrice <= 0) {
    if (form.status === "open" && form.pricingMode === "binance") {
      return (
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3.5 text-xs text-text-secondary">
          <p className="font-medium text-text-primary">实时价格将在保存后自动刷新</p>
          <p className="mt-1">
            币安模式会按更真实的可成交价结算：多头取买一盘口的卖出价格
            `bid1`，空头取卖一盘口的买回价格 `ask1`。
          </p>
        </div>
      );
    }

    return null;
  }

  const multiplier = isShort ? -1 : 1;
  const gross = multiplier * (comparePrice - entryPrice) * quantity;
  const net = gross - fees;
  const percent = (net / (entryPrice * quantity)) * 100;
  const isPositive = net > 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 text-xs",
        isPositive ? "bg-profit/5 border-profit/20" : "bg-loss/5 border-loss/20"
      )}
    >
      <p className="mb-2.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
        盈亏预览（{form.status === "open" ? "未实现" : "已实现"}）
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="flex justify-between">
          <span className="text-text-muted">入场市值</span>
          <span className="tabular-nums text-text-secondary">
            {formatCurrency(entryPrice * quantity)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">
            {form.status === "closed" ? "出场市值" : "当前市值"}
          </span>
          <span className="tabular-nums text-text-secondary">
            {formatCurrency(comparePrice * quantity)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">毛盈亏</span>
          <span className={cn("tabular-nums", isPositive ? "text-profit" : "text-loss")}>
            {gross > 0 ? "+" : ""}
            {formatCurrency(gross)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">手续费</span>
          <span className="tabular-nums text-text-secondary">
            -{formatCurrency(fees)}
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
        <span className="font-medium text-text-primary">净盈亏</span>
        <div className="text-right">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              isPositive ? "text-profit" : "text-loss"
            )}
          >
            {net > 0 ? "+" : ""}
            {formatCurrency(net)}
          </span>
          <span
            className={cn(
              "ml-2 tabular-nums",
              isPositive ? "text-profit" : "text-loss"
            )}
          >
            ({percent > 0 ? "+" : ""}
            {percent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function Segment<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; activeClass: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </span>
      )}

      <div className="flex h-9 rounded-lg border border-border bg-surface-2 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md text-xs font-medium transition-all duration-150",
              value === option.value
                ? option.activeClass
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TradeFormProps {
  initialValues?: TradeFormState;
  onSubmit: (data: TradeFormState) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function TradeForm({
  initialValues = EMPTY_FORM,
  onSubmit,
  onCancel,
  submitLabel = "保存交易",
}: TradeFormProps) {
  const [form, setForm] = useState<TradeFormState>(initialValues);
  const [errors, setErrors] = useState<TradeFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof TradeFormState) => (value: string | string[]) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });

  function setTicker(value: string) {
    setForm((prev) => {
      const ticker = value.toUpperCase();
      const next: TradeFormState = {
        ...prev,
        ticker,
      };

      if (prev.pricingMode === "binance" && !prev.binanceSymbol) {
        next.binanceSymbol = suggestBinanceSymbol(ticker);
      }

      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function setPricingMode(value: TradePricingMode) {
    setForm((prev) => {
      const next: TradeFormState = {
        ...prev,
        pricingMode: value,
      };

      if (value === "binance" && !prev.binanceSymbol) {
        next.binanceSymbol = suggestBinanceSymbol(prev.ticker);
      }

      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitted(true);

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(form);
    }
  }

  const isClosed = form.status === "closed";
  const isBinanceMode = form.pricingMode === "binance";

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="代码 *"
            value={form.ticker}
            onChange={(event) => setTicker(event.target.value)}
            placeholder="如 BTC / META / XAG"
            error={errors.ticker}
            className="uppercase"
          />
          <Input
            label="名称"
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            placeholder="公司 / 资产名称"
          />
        </div>

        <Segment
          label="价格模式"
          value={form.pricingMode}
          onChange={setPricingMode}
          options={[
            {
              value: "manual",
              label: "手动模式",
              activeClass: "bg-surface-4 text-text-primary",
            },
            {
              value: "binance",
              label: "币安模式",
              activeClass: "bg-accent/15 text-accent",
            },
          ]}
        />

        {isBinanceMode && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
            <Select
              label="币安市场 *"
              value={form.binanceMarketType}
              onChange={(value) => set("binanceMarketType")(value)}
              options={[
                { value: "spot", label: "现货 Spot" },
                { value: "usdm-futures", label: "U 本位合约" },
              ]}
            />
            <Input
              label="币安代码 *"
              value={form.binanceSymbol}
              onChange={(event) => set("binanceSymbol")(event.target.value.toUpperCase())}
              placeholder="如 BTCUSDT / XAGUSDT"
              hint="用于匹配币安盘口价格，展示代码仍然使用左侧的“代码”"
              error={errors.binanceSymbol}
              className="uppercase"
            />
            {form.status === "open" && (
              <div className="col-span-2">
                <Input
                  label="当前价格"
                  value={form.currentPrice}
                  placeholder="保存后自动刷新"
                  hint="多头按 bid1 结算，空头按 ask1 结算"
                  disabled
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="资产类别 *"
            value={form.assetClass}
            onChange={set("assetClass")}
            options={[
              { value: "stock", label: "股票" },
              { value: "etf", label: "ETF" },
              { value: "crypto", label: "加密货币" },
              { value: "forex", label: "外汇" },
              { value: "futures", label: "期货" },
              { value: "option", label: "期权" },
              { value: "other", label: "其他" },
            ]}
          />
          <Select
            label="货币 *"
            value={form.currency}
            onChange={set("currency")}
            options={[
              { value: "USD", label: "USD" },
              { value: "HKD", label: "HKD" },
              { value: "CNY", label: "CNY" },
              { value: "EUR", label: "EUR" },
              { value: "GBP", label: "GBP" },
              { value: "JPY", label: "JPY" },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Segment
            label="方向"
            value={form.direction}
            onChange={set("direction") as (value: TradeDirection) => void}
            options={[
              {
                value: "long",
                label: "做多",
                activeClass: "bg-profit/15 text-profit",
              },
              {
                value: "short",
                label: "做空",
                activeClass: "bg-loss/15 text-loss",
              },
            ]}
          />

          <Segment
            label="状态"
            value={form.status}
            onChange={set("status") as (value: TradeStatus) => void}
            options={[
              {
                value: "open",
                label: "持仓中",
                activeClass: "bg-accent/15 text-accent",
              },
              {
                value: "closed",
                label: "已平仓",
                activeClass: "bg-surface-4 text-text-primary",
              },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="datetime-local"
            label="入场时间 *"
            value={form.entryDate}
            onChange={(event) => set("entryDate")(event.target.value)}
            error={errors.entryDate}
          />
          {isClosed ? (
            <Input
              type="datetime-local"
              label="出场时间 *"
              value={form.exitDate}
              onChange={(event) => set("exitDate")(event.target.value)}
              error={errors.exitDate}
            />
          ) : (
            <div />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="入场价 *"
            value={form.entryPrice}
            onChange={(event) => set("entryPrice")(event.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            error={errors.entryPrice}
          />
          {isClosed ? (
            <Input
              type="number"
              label="出场价 *"
              value={form.exitPrice}
              onChange={(event) => set("exitPrice")(event.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              error={errors.exitPrice}
            />
          ) : isBinanceMode ? (
            <Input
              type="number"
              label="当前价格"
              value={form.currentPrice}
              placeholder="保存后自动刷新"
              min="0"
              step="any"
              disabled
            />
          ) : (
            <Input
              type="number"
              label="当前价格"
              value={form.currentPrice}
              onChange={(event) => set("currentPrice")(event.target.value)}
              placeholder="用于计算未实现盈亏"
              min="0"
              step="any"
              error={errors.currentPrice}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="数量 *"
            value={form.quantity}
            onChange={(event) => set("quantity")(event.target.value)}
            placeholder="0"
            min="0"
            step="any"
            error={errors.quantity}
          />
          <Input
            type="number"
            label="手续费"
            value={form.fees}
            onChange={(event) => set("fees")(event.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
          />
        </div>

        <Input
          label="形态类型"
          value={form.setupType}
          onChange={(event) => set("setupType")(event.target.value)}
          placeholder="如 突破、回调、均值回归"
        />

        <TagInput
          label="标签"
          tags={form.tags}
          onChange={set("tags") as (value: string[]) => void}
          hint="按 Enter 或逗号添加"
        />

        <Textarea
          label="备注"
          value={form.notes}
          onChange={(event) => set("notes")(event.target.value)}
          placeholder="交易理由、观察、经验总结"
          className="min-h-[80px]"
        />

        <PnLPreview form={form} />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-1 px-5 py-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
