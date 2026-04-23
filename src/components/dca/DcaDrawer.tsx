"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  pauseSync,
  resumeSync,
  saveDcaEntryToServer,
  updateDcaEntryOnServer,
} from "@/lib/server-sync-client";
import { cn } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import { useDcaEntries } from "@/store/useDcaEntries";
import type { DcaEntry } from "@/types";
import { DcaForm, EMPTY_DCA_FORM, dcaToForm, formToDcaEntry } from "./DcaForm";
import type { DcaFormState } from "./DcaForm";

interface DcaDrawerProps {
  open: boolean;
  onClose: () => void;
  editingEntry?: DcaEntry | null;
  initialValues?: DcaFormState | null;
}

function makeDcaId(): string {
  return `dca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const DRAWER_LABEL = "\u5b9a\u6295\u8868\u5355";
const CLOSE_LABEL = "\u5173\u95ed";
const CREATE_BUY_TITLE = "\u65b0\u589e\u4e70\u5165\u8bb0\u5f55";
const CREATE_SELL_TITLE = "\u65b0\u589e\u6b62\u76c8\u5356\u51fa\u8bb0\u5f55";
const EDIT_BUY_TITLE = "\u7f16\u8f91\u4e70\u5165\u8bb0\u5f55";
const EDIT_SELL_TITLE = "\u7f16\u8f91\u6b62\u76c8\u5356\u51fa\u8bb0\u5f55";
const SAVE_ERROR = "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const SUBMITTING_LABEL = "\u63d0\u4ea4\u4e2d...";
const SAVE_CHANGES_LABEL = "\u4fdd\u5b58\u4fee\u6539";
const ADD_BUY_LABEL = "\u4fdd\u5b58\u4e70\u5165";
const ADD_SELL_LABEL = "\u4fdd\u5b58\u5356\u51fa";

export function DcaDrawer({ open, onClose, editingEntry, initialValues: draftValues }: DcaDrawerProps) {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const upsertEntry = useDcaEntries((state) => state.upsertEntry);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      pauseSync();
    }

    return () => {
      if (open) {
        resumeSync();
      }
    };
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, submitting]);

  async function handleSubmit(data: DcaFormState) {
    const entryData = formToDcaEntry(data);
    setSubmitting(true);
    setError("");

    try {
      if (editingEntry) {
        const entry: DcaEntry = {
          ...editingEntry,
          ...entryData,
          id: editingEntry.id,
          createdAt: editingEntry.createdAt,
          updatedAt: new Date().toISOString(),
        };

        const savedEntry = await updateDcaEntryOnServer(activeUserId, entry);
        upsertEntry(savedEntry);
      } else {
        const now = new Date().toISOString();
        const entry: DcaEntry = {
          ...entryData,
          id: makeDcaId(),
          createdAt: now,
          updatedAt: now,
        };

        const savedEntry = await saveDcaEntryToServer(activeUserId, entry);
        upsertEntry(savedEntry);
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || SAVE_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  const initialValues = editingEntry ? dcaToForm(editingEntry) : draftValues ?? EMPTY_DCA_FORM;
  const [liveValues, setLiveValues] = useState<DcaFormState>(initialValues);

  useEffect(() => {
    if (!open) return;
    setLiveValues(initialValues);
  }, [initialValues, open]);

  const isEditing = Boolean(editingEntry);
  const currentSide = liveValues.side;
  const title = isEditing
    ? currentSide === "sell"
      ? EDIT_SELL_TITLE
      : EDIT_BUY_TITLE
    : currentSide === "sell"
      ? CREATE_SELL_TITLE
      : CREATE_BUY_TITLE;
  const submitText = submitting
    ? SUBMITTING_LABEL
    : isEditing
      ? SAVE_CHANGES_LABEL
      : currentSide === "sell"
        ? ADD_SELL_LABEL
        : ADD_BUY_LABEL;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={submitting ? undefined : onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-l border-border bg-surface-1 shadow-[0_0_32px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out sm:w-[560px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label={DRAWER_LABEL}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50 lg:hidden"
              aria-label={CLOSE_LABEL}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">
              {title}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            aria-label={CLOSE_LABEL}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {open && (
          <div className="flex min-h-0 flex-1 flex-col">
            {error && (
              <div className="mx-5 mt-3 shrink-0 rounded-lg border border-loss/20 bg-loss/10 px-3 py-2 text-xs text-loss">
                {error}
              </div>
            )}
            <DcaForm
              key={editingEntry?.id ?? `${initialValues.ticker}:${initialValues.investedAt}:new`}
              initialValues={initialValues}
              className="min-h-0 flex-1"
              onStateChange={setLiveValues}
              onSubmit={(values) => {
                void handleSubmit(values);
              }}
              onCancel={onClose}
              submitLabel={submitText}
            />
          </div>
        )}
      </div>
    </>
  );
}
