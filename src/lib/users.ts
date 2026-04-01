export type AppUserId = "me" | "partner";

export interface AppUserProfile {
  id: AppUserId;
  name: string;
}

export const APP_USERS: AppUserProfile[] = [
  { id: "me", name: "我" },
  { id: "partner", name: "女朋友" },
];

export function isAppUserId(value: unknown): value is AppUserId {
  return value === "me" || value === "partner";
}
