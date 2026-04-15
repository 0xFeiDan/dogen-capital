"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DcaEntry } from "@/types";
import type { AppUserId } from "./useAppUsers";
import { useAppUsers } from "./useAppUsers";

type DcaEntriesByUser = Record<AppUserId, DcaEntry[]>;

interface DcaEntriesState {
  entries: DcaEntry[];
  dcaEntriesByUser: DcaEntriesByUser;
  _hydrated: boolean;
}

interface DcaEntriesActions {
  addEntry: (draft: Omit<DcaEntry, "id" | "createdAt" | "updatedAt">) => DcaEntry;
  upsertEntry: (entry: DcaEntry) => void;
  updateEntry: (id: string, updates: Partial<Omit<DcaEntry, "id" | "createdAt">>) => void;
  deleteEntry: (id: string) => void;
  replaceAllDcaEntriesByUser: (dcaEntriesByUser: Partial<DcaEntriesByUser>) => void;
  importEntries: (entries: DcaEntry[]) => void;
  mergeEntries: (entries: DcaEntry[]) => void;
  setHydrated: () => void;
  syncActiveUser: () => void;
}

export type DcaEntriesStore = DcaEntriesState & DcaEntriesActions;

interface PersistedDcaEntriesState {
  dcaEntriesByUser?: Partial<DcaEntriesByUser>;
  entries?: DcaEntry[];
}

function makeId(): string {
  return `dca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneEntries(entries: DcaEntry[]): DcaEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function createDefaultEntriesByUser(): DcaEntriesByUser {
  return {
    me: [],
    partner: [],
  };
}

function normalizeEntriesByUser(value?: Partial<DcaEntriesByUser>): DcaEntriesByUser {
  const defaults = createDefaultEntriesByUser();

  return {
    me: Array.isArray(value?.me) ? cloneEntries(value.me) : defaults.me,
    partner: Array.isArray(value?.partner) ? cloneEntries(value.partner) : defaults.partner,
  };
}

function getActiveUserId(): AppUserId {
  return useAppUsers.getState().activeUserId;
}

function getCurrentUserEntries(
  dcaEntriesByUser: DcaEntriesByUser,
  userId = getActiveUserId()
): DcaEntry[] {
  return dcaEntriesByUser[userId] ?? [];
}

function updateActiveUserEntries(
  state: DcaEntriesState,
  recipe: (entries: DcaEntry[]) => DcaEntry[]
): Pick<DcaEntriesState, "entries" | "dcaEntriesByUser"> {
  const activeUserId = getActiveUserId();
  const nextEntries = recipe(getCurrentUserEntries(state.dcaEntriesByUser, activeUserId));
  const nextEntriesByUser: DcaEntriesByUser = {
    ...state.dcaEntriesByUser,
    [activeUserId]: nextEntries,
  };

  return {
    entries: nextEntries,
    dcaEntriesByUser: nextEntriesByUser,
  };
}

export const useDcaEntries = create<DcaEntriesStore>()(
  persist(
    (set, get) => ({
      entries: [],
      dcaEntriesByUser: createDefaultEntriesByUser(),
      _hydrated: false,

      addEntry(draft) {
        const now = nowIso();
        const entry: DcaEntry = {
          ...draft,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => updateActiveUserEntries(state, (entries) => [entry, ...entries]));
        return entry;
      },

      upsertEntry(entry) {
        set((state) =>
          updateActiveUserEntries(state, (entries) => {
            const existingIndex = entries.findIndex((item) => item.id === entry.id);
            if (existingIndex === -1) {
              return [entry, ...entries];
            }

            const nextEntries = [...entries];
            nextEntries[existingIndex] = { ...entry };
            return nextEntries;
          })
        );
      },

      updateEntry(id, updates) {
        set((state) =>
          updateActiveUserEntries(state, (entries) =>
            entries.map((entry) =>
              entry.id === id ? { ...entry, ...updates, id, updatedAt: nowIso() } : entry
            )
          )
        );
      },

      deleteEntry(id) {
        set((state) =>
          updateActiveUserEntries(state, (entries) => entries.filter((entry) => entry.id !== id))
        );
      },

      replaceAllDcaEntriesByUser(dcaEntriesByUser) {
        const normalized = normalizeEntriesByUser(dcaEntriesByUser);
        set({
          dcaEntriesByUser: normalized,
          entries: getCurrentUserEntries(normalized),
        });
      },

      importEntries(entries) {
        set((state) => updateActiveUserEntries(state, () => cloneEntries(entries)));
      },

      mergeEntries(incoming) {
        set((state) =>
          updateActiveUserEntries(state, (entries) => {
            const existingIds = new Set(entries.map((entry) => entry.id));
            const novel = cloneEntries(incoming).filter((entry) => !existingIds.has(entry.id));
            return [...novel, ...entries];
          })
        );
      },

      setHydrated() {
        set({ _hydrated: true });
      },

      syncActiveUser() {
        const { dcaEntriesByUser } = get();
        set({
          entries: getCurrentUserEntries(dcaEntriesByUser),
        });
      },
    }),
    {
      name: "dogen-dca-entries",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dcaEntriesByUser: state.dcaEntriesByUser,
      }),
      migrate: (persistedState) => {
        const state = persistedState as PersistedDcaEntriesState | undefined;

        if (state?.dcaEntriesByUser) {
          return {
            dcaEntriesByUser: normalizeEntriesByUser(state.dcaEntriesByUser),
          };
        }

        if (Array.isArray(state?.entries)) {
          return {
            dcaEntriesByUser: normalizeEntriesByUser({
              me: state.entries,
              partner: [],
            }),
          };
        }

        return {
          dcaEntriesByUser: createDefaultEntriesByUser(),
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
  useDcaEntries.getState().syncActiveUser();
});
