"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const DEFAULT_INITIAL_CAPITAL = 100000;

interface PortfolioSettingsState {
  initialCapital: number;
}

interface PortfolioSettingsActions {
  setInitialCapital: (value: number) => void;
}

export type PortfolioSettingsStore =
  PortfolioSettingsState & PortfolioSettingsActions;

export const usePortfolioSettings = create<PortfolioSettingsStore>()(
  persist(
    (set) => ({
      initialCapital: DEFAULT_INITIAL_CAPITAL,
      setInitialCapital(value) {
        set({
          initialCapital: Math.round(Math.max(value, 0) * 100) / 100,
        });
      },
    }),
    {
      name: "dogen-portfolio-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
