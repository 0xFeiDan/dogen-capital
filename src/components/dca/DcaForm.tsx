"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn, formatCurrency, formatPrice } from "@/lib/utils";
import type { Currency, DcaAssetClass, DcaEntry } from "@/types";

export interface DcaFormState {
  ticker: string;
  name: string;
  assetClass: DcaAssetClass;
  currency: Currency;
  investedAt: string;
  investedAmount: string;
  quantity: string;
  notes: string;
}

interface DcaFormErrors {
  ticker?: string;
  investedAt?: string;
  investedAmount?: string;
  quantity?: string;
}

export const EMPTY_DCA_FORM: DcaFormState = {
  ticker: "",
  name: "",
  assetClass: "stock",
  currency: "USD",
  investedAt: "",
  investedAmount: "",
  quantity: "",
  notes: "",
};

const SUBMIT_LABEL = "\u4fdd\u5b58\u8bb0\u5f55";
const TICKER_LABEL = "\u4ee3\u7801 *";
const NAME_LABEL = "\u540d\u79f0";
const ASSET_CLASS_LABEL = "\u677f\u5757 *";
const CURRENCY_LABEL = "\u8ba1\u4ef7\u8d27\u5e01 *";
const DATE_LABEL = "\u5b9a\u6295\u65e5\u671f *";
const AMOUNT_LABEL = "\u6295\u5165\u91d1\u989d *";
const QUANTITY_LABEL = "\u4e70\u5165\u6570\u91cf *";
const NOTES_LABEL = "\u5907\u6ce8";
const NAME_PLACEHOLDER = "\u8d44\u4ea7\u540d\u79f0";
const NOTES_PLACEHOLDER =
  "\u4f8b\u5982\uff1a\u6bcf\u6708\u5de5\u8d44\u65e5\u5b9a\u6295\u3001\u66b4\u8dcc\u8865\u4ed3\u3001\u5b63\u5ea6\u52a0\u4ed3\u8ba1\u5212";
const PREVIEW_LABEL = "\u672c\u6b21\u5b9a\u6295\u9884\u89c8";
const PREVIEW_AMOUNT = "\u6295\u5165\u91d1\u989d";
const PREVIEW_QUANTITY = "\u4e70\u5165\u6570\u91cf";
const PREVIEW_PRICE = "\u672c\u6b21\u5747\u4ef7";
const CANCEL_LABEL = "\u53d6\u6d88";
const TICKER_REQUIRED = "\u8bf7\u8f93\u5165\u4ee3\u7801";
const DATE_REQUIRED = "\u8bf7\u9009\u62e9\u5b9a\u6295\u65e5\u671f";
const AMOUNT_INVALID = "\u6295\u5165\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0";
const QUANTITY_INVALID = "\u6570\u91cf\u5fc5\u987b\u5927\u4e8e 0";

export function dcaToForm(entry: DcaEntry): DcaFormState {
  return {
    ticker: entry.ticker,
    name: entry.name ?? "",
    assetClass: entry.assetClass,
    currency: entry.currency,
    investedAt: entry.investedAt.slice(0, 10),
    investedAmount: String(entry.investedAmount),
    quantity: String(entry.quantity),
    notes: entry.notes ?? "",
  };
}

export function formToDcaEntry(
  form: DcaFormState
): Omit<DcaEntry, "id" | "createdAt" | "updatedAt"> {
  return {
    ticker: form.ticker.trim().toUpperCase(),
    name: form.name.trim() || undefined,
    assetClass: form.assetClass,
    currency: form.currency,
    investedAt: form.investedAt,
    investedAmount: Number(form.investedAmount),
    quantity: Number(form.quantity),
    notes: form.notes.trim() || undefined,
  };
}

function validate(form: DcaFormState): DcaFormErrors {
  const errors: DcaFormErrors = {};

  if (!form.ticker.trim()) {
    errors.ticker = TICKER_REQUIRED;
  }

  if (!form.investedAt) {
    errors.investedAt = DATE_REQUIRED;
  }

  const investedAmount = Number(form.investedAmount);
  if (!Number.isFinite(investedAmount) || investedAmount <= 0) {
    errors.investedAmount = AMOUNT_INVALID;
  }

  const quantity = Number(form.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = QUANTITY_INVALID;
  }

  return errors;
}

interface DcaFormProps {
  initialValues?: DcaFormState;
  onSubmit: (data: DcaFormState) => void;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
}

export function DcaForm({
  initialValues = EMPTY_DCA_FORM,
  onSubmit,
  onCancel,
  submitLabel = SUBMIT_LABEL,
  className,
}: DcaFormProps) {
  const [form, setForm] = useState<DcaFormState>(initialValues);
  const [errors, setErrors] = useState<DcaFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set =
    <K extends keyof DcaFormState>(key: K) =>
    (value: DcaFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        if (submitted) setErrors(validate(next));
        return next;
      });
    };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitted(true);

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(form);
    }
  }

  const investedAmount = Number(form.investedAmount);
  const quantity = Number(form.quantity);
  const averageCost =
    Number.isFinite(investedAmount) &&
    investedAmount > 0 &&
    Number.isFinite(quantity) &&
    quantity > 0
      ? investedAmount / quantity
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 pb-8 overscroll-contain">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={TICKER_LABEL}
            value={form.ticker}
            onChange={(event) => set("ticker")(event.target.value.toUpperCase())}
            placeholder="BTC / NVDA / TSLA"
            error={errors.ticker}
            className="uppercase"
          />
          <Input
            label={NAME_LABEL}
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            placeholder={NAME_PLACEHOLDER}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={ASSET_CLASS_LABEL}
            value={form.assetClass}
            onChange={(value) => set("assetClass")(value as DcaAssetClass)}
            options={[
              { value: "stock", label: FILTER_STOCK },
              { value: "crypto", label: FILTER_CRYPTO },
            ]}
          />
          <Select
            label={CURRENCY_LABEL}
            value={form.currency}
            onChange={(value) => set("currency")(value as Currency)}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="date"
            label={DATE_LABEL}
            value={form.investedAt}
            onChange={(event) => set("investedAt")(event.target.value)}
            error={errors.investedAt}
          />
          <Input
            type="number"
            label={AMOUNT_LABEL}
            value={form.investedAmount}
            onChange={(event) => set("investedAmount")(event.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            error={errors.investedAmount}
          />
        </div>

        <Input
          type="number"
          label={QUANTITY_LABEL}
          value={form.quantity}
          onChange={(event) => set("quantity")(event.target.value)}
          placeholder="0"
          min="0"
          step="any"
          error={errors.quantity}
        />

        {averageCost != null && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-text-muted">
              {PREVIEW_LABEL}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="text-2xs text-text-muted">{PREVIEW_AMOUNT}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary tabular-nums">
                  {formatCurrency(investedAmount, form.currency)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-muted">{PREVIEW_QUANTITY}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary tabular-nums">
                  {quantity.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 8,
                  })}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-muted">{PREVIEW_PRICE}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary tabular-nums">
                  {formatPrice(averageCost, form.currency)}
                </p>
              </div>
            </div>
          </div>
        )}

        <Textarea
          label={NOTES_LABEL}
          value={form.notes}
          onChange={(event) => set("notes")(event.target.value)}
          placeholder={NOTES_PLACEHOLDER}
          className="min-h-[100px]"
        />
      </div>

      <div
        className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-1 px-5 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <Button type="button" variant="ghost" onClick={onCancel}>
          {CANCEL_LABEL}
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const FILTER_STOCK = "\u80a1\u7968";
const FILTER_CRYPTO = "\u865a\u62df\u8d27\u5e01";
