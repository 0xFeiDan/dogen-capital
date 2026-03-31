"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppUserId = "me" | "partner";

export interface AppUserProfile {
  id: AppUserId;
  name: string;
}

export const APP_USERS: AppUserProfile[] = [
  { id: "me", name: "我" },
  { id: "partner", name: "女朋友" },
];

interface AppUsersState {
  activeUserId: AppUserId;
}

interface AppUsersActions {
  setActiveUser: (userId: AppUserId) => void;
}

export const useAppUsers = create<AppUsersState & AppUsersActions>()(
  persist(
    (set) => ({
      activeUserId: "me",
      setActiveUser(userId) {
        set({ activeUserId: userId });
      },
    }),
    {
      name: "dogen-active-user",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
