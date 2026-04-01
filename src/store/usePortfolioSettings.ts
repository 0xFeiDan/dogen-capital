"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppUserId } from "./useAppUsers";
import { useAppUsers } from "./useAppUsers";

const DEFAULT_INITIAL_CAPITAL = 100000;

interface PortfolioSetting {
  initialCapital: number;
}

type PortfolioSettingsByUser = Record<AppUserId, PortfolioSetting>;

interface PortfolioSettingsState {
  initialCapital: number;
  settingsByUser: PortfolioSettingsByUser;
  _hydrated: boolean;
}

interface PortfolioSettingsActions {
  setInitialCapital: (value: number) => void;
  replaceAllSettingsByUser: (settingsByUser: Partial<PortfolioSettingsByUser>) => void;
  syncActiveUser: () => void;
  setHydrated: () => void;
}

export type PortfolioSettingsStore = PortfolioSettingsState & PortfolioSettingsActions;

interface PersistedPortfolioSettingsState {
  settingsByUser?: Partial<PortfolioSettingsByUser>;
  initialCapital?: number;
}

function normalizeCapital(value: number): number {
  return Math.round(Math.max(value, 0) * 100) / 100;
}

function createDefaultSettingsByUser(): PortfolioSettingsByUser {
  return {
    me: { initialCapital: DEFAULT_INITIAL_CAPITAL },
    partner: { initialCapital: DEFAULT_INITIAL_CAPITAL },
  };
}

function normalizeSettingsByUser(
  value?: Partial<PortfolioSettingsByUser>
): PortfolioSettingsByUser {
  const defaults = createDefaultSettingsByUser();

  return {
    me: {
      initialCapital: normalizeCapital(value?.me?.initialCapital ?? defaults.me.initialCapital),
    },
    partner: {
      initialCapital: normalizeCapital(
        value?.partner?.initialCapital ?? defaults.partner.initialCapital
      ),
    },
  };
}

function getActiveUserId(): AppUserId {
  return useAppUsers.getState().activeUserId;
}

function getCurrentInitialCapital(
  settingsByUser: PortfolioSettingsByUser,
  userId = getActiveUserId()
): number {
  return settingsByUser[userId]?.initialCapital ?? DEFAULT_INITIAL_CAPITAL;
}

export const usePortfolioSettings = create<PortfolioSettingsStore>()(
  persist(
    (set, get) => ({
      initialCapital: DEFAULT_INITIAL_CAPITAL,
      settingsByUser: createDefaultSettingsByUser(),
      _hydrated: false,

      setInitialCapital(value) {
        const activeUserId = getActiveUserId();
        const initialCapital = normalizeCapital(value);
        const settingsByUser: PortfolioSettingsByUser = {
          ...get().settingsByUser,
          [activeUserId]: { initialCapital },
        };

        set({
          initialCapital,
          settingsByUser,
        });
      },

      replaceAllSettingsByUser(settingsByUser) {
        const normalized = normalizeSettingsByUser(settingsByUser);
        set({
          settingsByUser: normalized,
          initialCapital: getCurrentInitialCapital(normalized),
        });
      },

      syncActiveUser() {
        set({
          initialCapital: getCurrentInitialCapital(get().settingsByUser),
        });
      },

      setHydrated() {
        set({ _hydrated: true });
      },
    }),
    {
      name: "dogen-portfolio-settings",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settingsByUser: state.settingsByUser,
      }),
      migrate: (persistedState) => {
        const state = persistedState as PersistedPortfolioSettingsState | undefined;

        if (state?.settingsByUser) {
          return {
            settingsByUser: normalizeSettingsByUser(state.settingsByUser),
          };
        }

        if (typeof state?.initialCapital === "number") {
          return {
            settingsByUser: normalizeSettingsByUser({
              me: { initialCapital: state.initialCapital },
            }),
          };
        }

        return {
          settingsByUser: createDefaultSettingsByUser(),
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
  usePortfolioSettings.getState().syncActiveUser();
});
