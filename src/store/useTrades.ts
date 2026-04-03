"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTradePricingMode, normalizeTrade } from "@/lib/pricing";
import type { Trade } from "@/types";
import { SEED_TRADES } from "@/lib/seed";
import type { AppUserId } from "./useAppUsers";
import { useAppUsers } from "./useAppUsers";

type TradesByUser = Record<AppUserId, Trade[]>;

interface TradesState {
  trades: Trade[];
  tradesByUser: TradesByUser;
  _hydrated: boolean;
}

interface TradesActions {
  addTrade: (draft: Omit<Trade, "id" | "createdAt" | "updatedAt">) => Trade;
  upsertTrade: (trade: Trade) => void;
  updateTrade: (id: string, updates: Partial<Omit<Trade, "id" | "createdAt">>) => void;
  applyLivePriceUpdates: (
    updates: Array<{ id: string; currentPrice: number }>
  ) => void;
  deleteTrade: (id: string) => void;
  deleteTrades: (ids: string[]) => void;
  importTrades: (trades: Trade[]) => void;
  mergeTrades: (trades: Trade[]) => void;
  replaceAllTradesByUser: (tradesByUser: Partial<TradesByUser>) => void;
  resetToSeed: () => void;
  getTradeById: (id: string) => Trade | undefined;
  setHydrated: () => void;
  syncActiveUser: () => void;
}

export type TradesStore = TradesState & TradesActions;

interface PersistedTradesState {
  tradesByUser?: Partial<TradesByUser>;
  trades?: Trade[];
}

function makeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneTrades(trades: Trade[]): Trade[] {
  return trades.map((trade) =>
    normalizeTrade({
      ...trade,
      tags: [...trade.tags],
    })
  );
}

function mergeIncomingTrades(
  currentTrades: Trade[],
  incomingTrades: Trade[]
): Trade[] {
  const currentById = new Map(currentTrades.map((trade) => [trade.id, trade] as const));

  return cloneTrades(incomingTrades).map((incomingTrade) => {
    const currentTrade = currentById.get(incomingTrade.id);

    if (
      currentTrade &&
      incomingTrade.status === "open" &&
      getTradePricingMode(incomingTrade) === "binance" &&
      currentTrade.currentPrice != null
    ) {
      // Keep local live price only when server has no price or local is fresher.
      // If server has a valid price (e.g. updated from another device), use it.
      const serverHasPrice =
        incomingTrade.currentPrice != null && incomingTrade.currentPrice > 0;

      if (!serverHasPrice) {
        return {
          ...incomingTrade,
          currentPrice: currentTrade.currentPrice,
        };
      }
    }

    return incomingTrade;
  });
}

function createDefaultTradesByUser(): TradesByUser {
  return {
    me: [],
    partner: [],
  };
}

function normalizeTradesByUser(value?: Partial<TradesByUser>): TradesByUser {
  const defaults = createDefaultTradesByUser();

  return {
    me: Array.isArray(value?.me) ? cloneTrades(value.me) : defaults.me,
    partner: Array.isArray(value?.partner) ? cloneTrades(value.partner) : defaults.partner,
  };
}

function getActiveUserId(): AppUserId {
  return useAppUsers.getState().activeUserId;
}

function getCurrentUserTrades(tradesByUser: TradesByUser, userId = getActiveUserId()): Trade[] {
  return tradesByUser[userId] ?? [];
}

function updateActiveUserTrades(
  state: TradesState,
  recipe: (trades: Trade[]) => Trade[]
): Pick<TradesState, "trades" | "tradesByUser"> {
  const activeUserId = getActiveUserId();
  const nextTrades = recipe(getCurrentUserTrades(state.tradesByUser, activeUserId));
  const nextTradesByUser: TradesByUser = {
    ...state.tradesByUser,
    [activeUserId]: nextTrades,
  };

  return {
    trades: nextTrades,
    tradesByUser: nextTradesByUser,
  };
}

export const useTrades = create<TradesStore>()(
  persist(
    (set, get) => ({
      trades: [],
      tradesByUser: createDefaultTradesByUser(),
      _hydrated: false,

      addTrade(draft) {
        const now = nowIso();
        const trade: Trade = {
          ...draft,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };

        const normalizedTrade = normalizeTrade(trade);

        set((state) =>
          updateActiveUserTrades(state, (trades) => [normalizedTrade, ...trades])
        );
        return normalizedTrade;
      },

      upsertTrade(trade) {
        const normalizedTrade = normalizeTrade(trade);

        set((state) =>
          updateActiveUserTrades(state, (trades) => {
            const existingIndex = trades.findIndex(
              (item) => item.id === normalizedTrade.id
            );
            if (existingIndex === -1) {
              return [normalizedTrade, ...trades];
            }

            const nextTrades = [...trades];
            nextTrades[existingIndex] = normalizedTrade;
            return nextTrades;
          })
        );
      },

      updateTrade(id, updates) {
        set((state) =>
          updateActiveUserTrades(state, (trades) =>
            trades.map((trade) =>
              trade.id === id ? { ...trade, ...updates, id, updatedAt: nowIso() } : trade
            )
          )
        );
      },

      applyLivePriceUpdates(updates) {
        if (updates.length === 0) return;

        const updatesById = new Map(
          updates.map((update) => [update.id, update.currentPrice] as const)
        );

        set((state) =>
          updateActiveUserTrades(state, (trades) =>
            trades.map((trade) => {
              const currentPrice = updatesById.get(trade.id);
              if (currentPrice == null) return trade;

              return {
                ...trade,
                currentPrice,
              };
            })
          )
        );
      },

      deleteTrade(id) {
        set((state) => updateActiveUserTrades(state, (trades) => trades.filter((trade) => trade.id !== id)));
      },

      deleteTrades(ids) {
        const idSet = new Set(ids);
        set((state) =>
          updateActiveUserTrades(state, (trades) => trades.filter((trade) => !idSet.has(trade.id)))
        );
      },

      importTrades(trades) {
        set((state) => updateActiveUserTrades(state, () => cloneTrades(trades)));
      },

      mergeTrades(incoming) {
        set((state) =>
          updateActiveUserTrades(state, (trades) => {
            const existingIds = new Set(trades.map((trade) => trade.id));
            const novel = cloneTrades(incoming).filter((trade) => !existingIds.has(trade.id));
            return [...novel, ...trades];
          })
        );
      },

      replaceAllTradesByUser(tradesByUser) {
        set((state) => {
          const normalizedIncoming = normalizeTradesByUser(tradesByUser);
          const mergedByUser: TradesByUser = {
            me: mergeIncomingTrades(state.tradesByUser.me ?? [], normalizedIncoming.me),
            partner: mergeIncomingTrades(
              state.tradesByUser.partner ?? [],
              normalizedIncoming.partner
            ),
          };

          return {
            tradesByUser: mergedByUser,
            trades: getCurrentUserTrades(mergedByUser),
          };
        });
      },

      resetToSeed() {
        set((state) => updateActiveUserTrades(state, () => cloneTrades(SEED_TRADES)));
      },

      getTradeById(id) {
        return get().trades.find((trade) => trade.id === id);
      },

      setHydrated() {
        set({ _hydrated: true });
      },

      syncActiveUser() {
        const { tradesByUser } = get();
        set({
          trades: getCurrentUserTrades(tradesByUser),
        });
      },
    }),
    {
      name: "dogen-trades",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tradesByUser: state.tradesByUser,
      }),
      migrate: (persistedState) => {
        const state = persistedState as PersistedTradesState | undefined;

        if (state?.tradesByUser) {
          return {
            tradesByUser: normalizeTradesByUser(state.tradesByUser),
          };
        }

        if (Array.isArray(state?.trades)) {
          return {
            tradesByUser: normalizeTradesByUser({
              me: state.trades,
              partner: [],
            }),
          };
        }

        return {
          tradesByUser: createDefaultTradesByUser(),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.syncActiveUser();
        state?.setHydrated();
      },
    }
  )
);

useAppUsers.subscribe(() => {
  useTrades.getState().syncActiveUser();
});
