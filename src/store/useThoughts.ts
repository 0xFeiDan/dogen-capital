"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Thought, ThoughtCategory } from "@/types";
import { SEED_THOUGHTS } from "@/lib/seed";
import type { AppUserId } from "./useAppUsers";
import { useAppUsers } from "./useAppUsers";

type ThoughtsByUser = Record<AppUserId, Thought[]>;

interface ThoughtsState {
  thoughts: Thought[];
  thoughtsByUser: ThoughtsByUser;
  _hydrated: boolean;
}

interface ThoughtsActions {
  addThought: (draft: Omit<Thought, "id" | "createdAt" | "updatedAt">) => Thought;
  upsertThought: (thought: Thought) => void;
  updateThought: (id: string, updates: Partial<Omit<Thought, "id" | "createdAt">>) => void;
  deleteThought: (id: string) => void;
  importThoughts: (thoughts: Thought[]) => void;
  mergeThoughts: (thoughts: Thought[]) => void;
  replaceAllThoughtsByUser: (thoughtsByUser: Partial<ThoughtsByUser>) => void;
  resetToSeed: () => void;
  getThoughtById: (id: string) => Thought | undefined;
  getThoughtsByCategory: (category: ThoughtCategory) => Thought[];
  setHydrated: () => void;
  syncActiveUser: () => void;
}

export type ThoughtsStore = ThoughtsState & ThoughtsActions;

interface PersistedThoughtsState {
  thoughtsByUser?: Partial<ThoughtsByUser>;
  thoughts?: Thought[];
}

function makeId(): string {
  return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneThoughts(thoughts: Thought[]): Thought[] {
  return thoughts.map((thought) => ({
    ...thought,
    tags: [...thought.tags],
  }));
}

function createDefaultThoughtsByUser(): ThoughtsByUser {
  return {
    me: [],
    partner: [],
  };
}

function normalizeThoughtsByUser(value?: Partial<ThoughtsByUser>): ThoughtsByUser {
  const defaults = createDefaultThoughtsByUser();

  return {
    me: Array.isArray(value?.me) ? cloneThoughts(value.me) : defaults.me,
    partner: Array.isArray(value?.partner) ? cloneThoughts(value.partner) : defaults.partner,
  };
}

function getActiveUserId(): AppUserId {
  return useAppUsers.getState().activeUserId;
}

function getCurrentUserThoughts(
  thoughtsByUser: ThoughtsByUser,
  userId = getActiveUserId()
): Thought[] {
  return thoughtsByUser[userId] ?? [];
}

function updateActiveUserThoughts(
  state: ThoughtsState,
  recipe: (thoughts: Thought[]) => Thought[]
): Pick<ThoughtsState, "thoughts" | "thoughtsByUser"> {
  const activeUserId = getActiveUserId();
  const nextThoughts = recipe(getCurrentUserThoughts(state.thoughtsByUser, activeUserId));
  const nextThoughtsByUser: ThoughtsByUser = {
    ...state.thoughtsByUser,
    [activeUserId]: nextThoughts,
  };

  return {
    thoughts: nextThoughts,
    thoughtsByUser: nextThoughtsByUser,
  };
}

export const useThoughts = create<ThoughtsStore>()(
  persist(
    (set, get) => ({
      thoughts: [],
      thoughtsByUser: createDefaultThoughtsByUser(),
      _hydrated: false,

      addThought(draft) {
        const now = nowIso();
        const thought: Thought = {
          ...draft,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => updateActiveUserThoughts(state, (thoughts) => [thought, ...thoughts]));
        return thought;
      },

      upsertThought(thought) {
        set((state) =>
          updateActiveUserThoughts(state, (thoughts) => {
            const existingIndex = thoughts.findIndex((item) => item.id === thought.id);
            if (existingIndex === -1) {
              return [thought, ...thoughts];
            }

            const nextThoughts = [...thoughts];
            nextThoughts[existingIndex] = {
              ...thought,
              tags: [...thought.tags],
            };
            return nextThoughts;
          })
        );
      },

      updateThought(id, updates) {
        set((state) =>
          updateActiveUserThoughts(state, (thoughts) =>
            thoughts.map((thought) =>
              thought.id === id ? { ...thought, ...updates, id, updatedAt: nowIso() } : thought
            )
          )
        );
      },

      deleteThought(id) {
        set((state) =>
          updateActiveUserThoughts(state, (thoughts) => thoughts.filter((thought) => thought.id !== id))
        );
      },

      importThoughts(thoughts) {
        set((state) => updateActiveUserThoughts(state, () => cloneThoughts(thoughts)));
      },

      mergeThoughts(incoming) {
        set((state) =>
          updateActiveUserThoughts(state, (thoughts) => {
            const existingIds = new Set(thoughts.map((thought) => thought.id));
            const novel = cloneThoughts(incoming).filter((thought) => !existingIds.has(thought.id));
            return [...novel, ...thoughts];
          })
        );
      },

      replaceAllThoughtsByUser(thoughtsByUser) {
        const normalized = normalizeThoughtsByUser(thoughtsByUser);
        set({
          thoughtsByUser: normalized,
          thoughts: getCurrentUserThoughts(normalized),
        });
      },

      resetToSeed() {
        set((state) => updateActiveUserThoughts(state, () => cloneThoughts(SEED_THOUGHTS)));
      },

      getThoughtById(id) {
        return get().thoughts.find((thought) => thought.id === id);
      },

      getThoughtsByCategory(category) {
        return get().thoughts.filter((thought) => thought.category === category);
      },

      setHydrated() {
        set({ _hydrated: true });
      },

      syncActiveUser() {
        const { thoughtsByUser } = get();
        set({
          thoughts: getCurrentUserThoughts(thoughtsByUser),
        });
      },
    }),
    {
      name: "dogen-thoughts",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        thoughtsByUser: state.thoughtsByUser,
      }),
      migrate: (persistedState) => {
        const state = persistedState as PersistedThoughtsState | undefined;

        if (state?.thoughtsByUser) {
          return {
            thoughtsByUser: normalizeThoughtsByUser(state.thoughtsByUser),
          };
        }

        if (Array.isArray(state?.thoughts)) {
          return {
            thoughtsByUser: normalizeThoughtsByUser({
              me: state.thoughts,
              partner: [],
            }),
          };
        }

        return {
          thoughtsByUser: createDefaultThoughtsByUser(),
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
  useThoughts.getState().syncActiveUser();
});
