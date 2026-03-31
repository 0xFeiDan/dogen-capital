import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Trade } from "@/types";
import { SEED_TRADES } from "@/lib/seed";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradesState {
  trades: Trade[];
  _hydrated: boolean;
}

interface TradesActions {
  /** Add a brand-new trade (id + timestamps auto-assigned) */
  addTrade: (draft: Omit<Trade, "id" | "createdAt" | "updatedAt">) => Trade;

  /** Update an existing trade by id */
  updateTrade: (id: string, updates: Partial<Omit<Trade, "id" | "createdAt">>) => void;

  /** Delete a single trade */
  deleteTrade: (id: string) => void;

  /** Delete multiple trades */
  deleteTrades: (ids: string[]) => void;

  /** Replace the entire trades array (used for CSV/JSON import) */
  importTrades: (trades: Trade[]) => void;

  /** Merge imported trades – skip duplicates by id */
  mergeTrades: (trades: Trade[]) => void;

  /** Reset to seed data */
  resetToSeed: () => void;

  /** Lookup helper */
  getTradeById: (id: string) => Trade | undefined;

  setHydrated: () => void;
}

export type TradesStore = TradesState & TradesActions;

// ─── Store ────────────────────────────────────────────────────────────────────

function makeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useTrades = create<TradesStore>()(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────���──────────────────
      trades: SEED_TRADES,
      _hydrated: false,

      // ── Actions ────────────────────────────────────────────────────────────
      addTrade(draft) {
        const now = nowIso();
        const trade: Trade = {
          ...draft,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ trades: [trade, ...s.trades] }));
        return trade;
      },

      updateTrade(id, updates) {
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === id ? { ...t, ...updates, id, updatedAt: nowIso() } : t
          ),
        }));
      },

      deleteTrade(id) {
        set((s) => ({ trades: s.trades.filter((t) => t.id !== id) }));
      },

      deleteTrades(ids) {
        const set_ = new Set(ids);
        set((s) => ({ trades: s.trades.filter((t) => !set_.has(t.id)) }));
      },

      importTrades(trades) {
        set({ trades });
      },

      mergeTrades(incoming) {
        const existingIds = new Set(get().trades.map((t) => t.id));
        const novel = incoming.filter((t) => !existingIds.has(t.id));
        set((s) => ({ trades: [...novel, ...s.trades] }));
      },

      resetToSeed() {
        set({ trades: SEED_TRADES });
      },

      getTradeById(id) {
        return get().trades.find((t) => t.id === id);
      },

      setHydrated() {
        set({ _hydrated: true });
      },
    }),
    {
      name: "dogen-trades",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
