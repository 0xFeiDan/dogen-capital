"use client";

import { triggerDownload } from "@/lib/io";
import type {
  DcaByUser,
  ServerBackupPayload,
  ServerSnapshot,
  SettingsByUser,
  ThoughtsByUser,
  TradesByUser,
} from "@/lib/server-data";
import type { AppUserId } from "@/lib/users";
import { useAppUsers } from "@/store/useAppUsers";
import { useDcaEntries } from "@/store/useDcaEntries";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";
import type { DcaEntry, Thought, Trade } from "@/types";

const DEFAULT_INITIAL_CAPITAL = 100000;

let syncPauseCount = 0;
let syncInFlight = false;

export function pauseSync() {
  syncPauseCount++;
}

export function resumeSync() {
  syncPauseCount = Math.max(0, syncPauseCount - 1);
}

export function isSyncPaused(): boolean {
  return syncPauseCount > 0;
}

export function isSyncInFlight(): boolean {
  return syncInFlight;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let data: (T & { error?: string }) | null = null;

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as T & { error?: string };
    } catch {
      if (!response.ok) {
        throw new Error(rawText.trim() || "服务器返回了非 JSON 错误响应");
      }

      throw new Error("服务器返回了无法解析的数据");
    }
  }

  if (!response.ok) {
    throw new Error(data?.error ?? (rawText.trim() || "请求失败"));
  }

  if (!data) {
    throw new Error("服务器返回了空响应");
  }

  return data;
}

export function applyServerSnapshot(snapshot: ServerSnapshot) {
  useTrades.getState().replaceAllTradesByUser(snapshot.tradesByUser);
  useThoughts.getState().replaceAllThoughtsByUser(snapshot.thoughtsByUser);
  useDcaEntries.getState().replaceAllDcaEntriesByUser(snapshot.dcaByUser);
  usePortfolioSettings.getState().replaceAllSettingsByUser(snapshot.settingsByUser);
}

function getLocalBackupPayload(): {
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  dcaByUser: DcaByUser;
  settingsByUser: SettingsByUser;
} {
  return {
    tradesByUser: useTrades.getState().tradesByUser,
    thoughtsByUser: useThoughts.getState().thoughtsByUser,
    dcaByUser: useDcaEntries.getState().dcaEntriesByUser,
    settingsByUser: usePortfolioSettings.getState().settingsByUser,
  };
}

function hasMeaningfulLocalData(payload: {
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  dcaByUser: DcaByUser;
  settingsByUser: SettingsByUser;
}) {
  return (
    Object.values(payload.tradesByUser).some((items) => items.length > 0) ||
    Object.values(payload.thoughtsByUser).some((items) => items.length > 0) ||
    Object.values(payload.dcaByUser).some((items) => items.length > 0) ||
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
  if (syncPauseCount > 0 || syncInFlight) {
    return null;
  }

  syncInFlight = true;

  try {
    const snapshot = await fetchServerSnapshot();

    if (syncPauseCount > 0) {
      return null;
    }

    if (!snapshot.serverHasData) {
      const localPayload = getLocalBackupPayload();
      if (hasMeaningfulLocalData(localPayload)) {
        await importBackupToServer({
          mode: "overwrite",
          payload: localPayload,
        });

        const refreshedSnapshot = await fetchServerSnapshot();
        if (syncPauseCount > 0) {
          return null;
        }

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

export async function updateTradeLivePricesOnServer(
  profileId: AppUserId,
  updates: Array<{ id: string; currentPrice: number }>
) {
  const response = await fetch("/api/data/trades/live-prices", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, updates }),
  });

  await parseJsonResponse<{ ok: true; count: number }>(response);
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

export async function saveDcaEntryToServer(
  profileId: AppUserId,
  entry: DcaEntry
): Promise<DcaEntry> {
  const response = await fetch("/api/data/dca", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, entry }),
  });

  const data = await parseJsonResponse<{ entry: DcaEntry }>(response);
  return data.entry;
}

export async function updateDcaEntryOnServer(
  profileId: AppUserId,
  entry: DcaEntry
): Promise<DcaEntry> {
  const response = await fetch(`/api/data/dca/${entry.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, entry }),
  });

  const data = await parseJsonResponse<{ entry: DcaEntry }>(response);
  return data.entry;
}

export async function deleteDcaEntryFromServer(profileId: AppUserId, entryId: string) {
  const response = await fetch(`/api/data/dca/${entryId}?profileId=${profileId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await parseJsonResponse<{ ok: true }>(response);
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
    dcaByUser: DcaByUser;
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
    const rawText = await response.text();

    if (rawText.trim()) {
      try {
        const data = JSON.parse(rawText) as { error?: string };
        throw new Error(data.error ?? "下载失败");
      } catch {
        throw new Error(rawText.trim() || "下载失败");
      }
    }

    throw new Error("下载失败");
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
