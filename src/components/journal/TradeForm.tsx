"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import {
  cn,
  formatCurrency,
  normalizeDateTimeInputValue,
  toDateTimeInputValue,
} from "@/lib/utils";
import type {
  AssetClass,
  Currency,
  Trade,
  TradeDirection,
  TradeStatus,
} from "@/types";

export interface TradeFormState {
  ticker: string;
  name: string;
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
}

export const EMPTY_FORM: TradeFormState = {
  ticker: "",
  name: "",
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

  return {
    ticker: form.ticker.trim().toUpperCase(),
    name: form.name.trim() || undefined,
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
    exitPrice: form.status === "closed" && !Number.isNaN(exitPrice) ? exitPrice : undefined,
    currentPrice:
      form.status === "open" && !Number.isNaN(currentPrice) && currentPrice > 0
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

  if (Number.isNaN(comparePrice) || comparePrice <= 0) return null;

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
      <p className="text-text-muted uppercase tracking-wider text-2xs font-medium mb-2.5">
        盈亏预览（{form.status === "open" ? "未实现" : "已实现"}）
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="flex justify-between">
          <span className="text-text-muted">入场市值</span>
          <span className="text-text-secondary tabular-nums">
            {formatCurrency(entryPrice * quantity)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">
            {form.status === "closed" ? "出场市值" : "当前市值"}
          </span>
          <span className="text-text-secondary tabular-nums">
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
          <span className="text-text-secondary tabular-nums">
            -{formatCurrency(fees)}
          </span>
        </div>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between">
        <span className="font-medium text-text-primary">净盈亏</span>
        <div className="text-right">
          <span
            className={cn(
              "font-semibold tabular-nums text-sm",
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
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </span>
      )}

      <div className="flex rounded-lg bg-surface-2 border border-border p-0.5 h-9">
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="代码 *"
            value={form.ticker}
            onChange={(event) => set("ticker")(event.target.value.toUpperCase())}
            placeholder="如 NVDA"
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
          ) : (
            <Input
              type="number"
              label="当前价格"
              value={form.currentPrice}
              onChange={(event) => set("currentPrice")(event.target.value)}
              placeholder="用于计算未实现盈亏"
              min="0"
              step="any"
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
          placeholder="交易理由、观察、经验教训"
          className="min-h-[80px]"
        />

        <PnLPreview form={form} />
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface-1">
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
