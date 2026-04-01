"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { APP_USERS, type AppUserId } from "@/lib/users";

export { APP_USERS };
export type { AppUserId } from "@/lib/users";

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
