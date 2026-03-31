import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Thought, ThoughtCategory } from "@/types";
import { SEED_THOUGHTS } from "@/lib/seed";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThoughtsState {
  thoughts: Thought[];
  _hydrated: boolean;
}

interface ThoughtsActions {
  addThought: (draft: Omit<Thought, "id" | "createdAt" | "updatedAt">) => Thought;
  updateThought: (id: string, updates: Partial<Omit<Thought, "id" | "createdAt">>) => void;
  deleteThought: (id: string) => void;
  importThoughts: (thoughts: Thought[]) => void;
  mergeThoughts: (thoughts: Thought[]) => void;
  resetToSeed: () => void;
  getThoughtById: (id: string) => Thought | undefined;
  getThoughtsByCategory: (category: ThoughtCategory) => Thought[];
  setHydrated: () => void;
}

export type ThoughtsStore = ThoughtsState & ThoughtsActions;

// ─── Store ────────────────────────────────────────────────────────────────────

function makeId(): string {
  return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useThoughts = create<ThoughtsStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      thoughts: SEED_THOUGHTS,
      _hydrated: false,

      // ── Actions ────────────────────────────────────────────────────────────
      addThought(draft) {
        const now = nowIso();
        const thought: Thought = {
          ...draft,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ thoughts: [thought, ...s.thoughts] }));
        return thought;
      },

      updateThought(id, updates) {
        set((s) => ({
          thoughts: s.thoughts.map((t) =>
            t.id === id ? { ...t, ...updates, id, updatedAt: nowIso() } : t
          ),
        }));
      },

      deleteThought(id) {
        set((s) => ({ thoughts: s.thoughts.filter((t) => t.id !== id) }));
      },

      importThoughts(thoughts) {
        set({ thoughts });
      },

      mergeThoughts(incoming) {
        const existingIds = new Set(get().thoughts.map((t) => t.id));
        const novel = incoming.filter((t) => !existingIds.has(t.id));
        set((s) => ({ thoughts: [...novel, ...s.thoughts] }));
      },

      resetToSeed() {
        set({ thoughts: SEED_THOUGHTS });
      },

      getThoughtById(id) {
        return get().thoughts.find((t) => t.id === id);
      },

      getThoughtsByCategory(category) {
        return get().thoughts.filter((t) => t.category === category);
      },

      setHydrated() {
        set({ _hydrated: true });
      },
    }),
    {
      name: "dogen-thoughts",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
