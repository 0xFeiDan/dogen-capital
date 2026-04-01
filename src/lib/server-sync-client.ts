"use client";

import { useAppUsers } from "@/store/useAppUsers";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";
import type {
  ServerBackupPayload,
  ServerSnapshot,
  SettingsByUser,
  ThoughtsByUser,
  TradesByUser,
} from "@/lib/server-data";
import type { Thought, Trade } from "@/types";
import type { AppUserId } from "@/lib/users";
import { triggerDownload } from "@/lib/io";

const DEFAULT_INITIAL_CAPITAL = 100000;

let syncPauseCount = 0;
let syncInFlight = false;

/** Increment pause counter — sync will be skipped while count > 0 */
export function pauseSync() {
  syncPauseCount++;
}

/** Decrement pause counter */
export function resumeSync() {
  syncPauseCount = Math.max(0, syncPauseCount - 1);
}

/** Returns true if sync is currently paused */
export function isSyncPaused(): boolean {
  return syncPauseCount > 0;
}

/** Returns true if a sync request is already in flight */
export function isSyncInFlight(): boolean {
  return syncInFlight;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }

  return data;
}

export function applyServerSnapshot(snapshot: ServerSnapshot) {
  useTrades.getState().replaceAllTradesByUser(snapshot.tradesByUser);
  useThoughts.getState().replaceAllThoughtsByUser(snapshot.thoughtsByUser);
  usePortfolioSettings.getState().replaceAllSettingsByUser(snapshot.settingsByUser);
}

function getLocalBackupPayload(): {
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  settingsByUser: SettingsByUser;
} {
  return {
    tradesByUser: useTrades.getState().tradesByUser,
    thoughtsByUser: useThoughts.getState().thoughtsByUser,
    settingsByUser: usePortfolioSettings.getState().settingsByUser,
  };
}

function hasMeaningfulLocalData(payload: {
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  settingsByUser: SettingsByUser;
}) {
  return (
    Object.values(payload.tradesByUser).some((items) => items.length > 0) ||
    Object.values(payload.thoughtsByUser).some((items) => items.length > 0) ||
    Object.values(payload.settingsByUser).some(
      (setting) => Math.round(setting.initialCapital * 100) / 100 !== DEFAULT_INITIAL_CAPITAL
    )
  );
}

export async function fetchServerSnapshot(): Promise<ServerSnapshot> {
  const response = await fetch("/api/data/bootstrap", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  return parseJsonResponse<ServerSnapshot>(response);
}

export async function syncServerSnapshot(): Promise<ServerSnapshot | null> {
  if (syncPauseCount > 0 || syncInFlight) return null;

  syncInFlight = true;

  try {
    const snapshot = await fetchServerSnapshot();

    // If sync was paused while request was in flight, discard result
    if (syncPauseCount > 0) return null;

    if (!snapshot.serverHasData) {
      const localPayload = getLocalBackupPayload();
      if (hasMeaningfulLocalData(localPayload)) {
        await importBackupToServer({
          mode: "overwrite",
          payload: localPayload,
        });

        const refreshedSnapshot = await fetchServerSnapshot();
        if (syncPauseCount > 0) return null;
        applyServerSnapshot(refreshedSnapshot);
        return refreshedSnapshot;
      }
    }

    applyServerSnapshot(snapshot);
    return snapshot;
  } finally {
    syncInFlight = false;
  }
}

export async function saveTradeToServer(profileId: AppUserId, trade: Trade): Promise<Trade> {
  const response = await fetch("/api/data/trades", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, trade }),
  });

  const data = await parseJsonResponse<{ trade: Trade }>(response);
  return data.trade;
}

export async function updateTradeOnServer(profileId: AppUserId, trade: Trade): Promise<Trade> {
  const response = await fetch(`/api/data/trades/${trade.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, trade }),
  });

  const data = await parseJsonResponse<{ trade: Trade }>(response);
  return data.trade;
}

export async function deleteTradeFromServer(profileId: AppUserId, tradeId: string) {
  const response = await fetch(`/api/data/trades/${tradeId}?profileId=${profileId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function saveThoughtToServer(
  profileId: AppUserId,
  thought: Thought
): Promise<Thought> {
  const response = await fetch("/api/data/thoughts", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, thought }),
  });

  const data = await parseJsonResponse<{ thought: Thought }>(response);
  return data.thought;
}

export async function updateThoughtOnServer(
  profileId: AppUserId,
  thought: Thought
): Promise<Thought> {
  const response = await fetch(`/api/data/thoughts/${thought.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, thought }),
  });

  const data = await parseJsonResponse<{ thought: Thought }>(response);
  return data.thought;
}

export async function deleteThoughtFromServer(profileId: AppUserId, thoughtId: string) {
  const response = await fetch(`/api/data/thoughts/${thoughtId}?profileId=${profileId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function updateInitialCapitalOnServer(
  profileId: AppUserId,
  initialCapital: number
) {
  const response = await fetch("/api/data/settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, initialCapital }),
  });

  const data = await parseJsonResponse<{ setting: { initialCapital: number } }>(response);
  return data.setting;
}

export async function importItemsToServer(params: {
  format: "trades-json" | "trades-csv" | "thoughts-json";
  mode: "merge" | "overwrite";
  profileId: AppUserId;
  items: Trade[] | Thought[];
}) {
  const response = await fetch("/api/data/import", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function importBackupToServer(params: {
  mode: "merge" | "overwrite";
  payload: {
    tradesByUser: TradesByUser;
    thoughtsByUser: ThoughtsByUser;
    settingsByUser: SettingsByUser;
  };
}) {
  const response = await fetch("/api/data/import", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      format: "backup-json",
      mode: params.mode,
      payload: params.payload,
    }),
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function downloadServerExport(
  type: "backup-json" | "trades-json" | "trades-csv" | "thoughts-json",
  profileId?: AppUserId
) {
  const searchParams = new URLSearchParams({ type });
  if (profileId) {
    searchParams.set("profileId", profileId);
  }

  const response = await fetch(`/api/data/export?${searchParams.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "下载失败");
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const match = contentDisposition.match(/filename="(.+)"/i);
  const filename = match?.[1] ?? `dogen-export-${Date.now()}.json`;
  const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";
  const text = await response.text();

  triggerDownload(text, filename, contentType);
}

export function getActiveUserId(): AppUserId {
  return useAppUsers.getState().activeUserId;
}

export function setActiveUserId(userId: AppUserId) {
  useAppUsers.getState().setActiveUser(userId);
}

export async function downloadAndReturnBackup(): Promise<ServerBackupPayload> {
  const response = await fetch("/api/data/export?type=backup-json", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  return parseJsonResponse<ServerBackupPayload>(response);
}
