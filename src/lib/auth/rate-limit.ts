import {
  LOGIN_BLOCK_MS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
} from "./constants";
import { db } from "@/lib/db";

interface AttemptState {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

interface RateLimitRow {
  count: number | bigint | string;
  windowStart: number | bigint | string;
  blockedUntil: number | bigint | string;
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_WINDOW_SECONDS = Math.ceil(LOGIN_WINDOW_MS / 1000);
const LOGIN_BLOCK_SECONDS = Math.ceil(LOGIN_BLOCK_MS / 1000);
let lastCleanup = Date.now();
let setupPromise: Promise<void> | null = null;

function fromDbNumber(value: number | bigint | string): number {
  return typeof value === "number" ? value : Number(value);
}

function fromDbTimestamp(value: number | bigint | string): number {
  const timestamp = fromDbNumber(value);
  return timestamp > 9_999_999_999 ? Math.floor(timestamp / 1000) : timestamp;
}

function normalizeState(row: RateLimitRow): AttemptState {
  return {
    count: fromDbNumber(row.count),
    windowStart: fromDbTimestamp(row.windowStart),
    blockedUntil: fromDbTimestamp(row.blockedUntil),
  };
}

async function ensureRateLimitTable() {
  if (!setupPromise) {
    setupPromise = db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "LoginRateLimit" (
        "clientKey" TEXT NOT NULL PRIMARY KEY,
        "count" INTEGER NOT NULL,
        "windowStart" INTEGER NOT NULL,
        "blockedUntil" INTEGER NOT NULL
      )
    `.then(() => undefined);
  }

  await setupPromise;
}

async function purgeStaleEntries() {
  const nowMs = Date.now();
  if (nowMs - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = nowMs;
  const now = Math.floor(nowMs / 1000);

  await db.$executeRaw`
    DELETE FROM "LoginRateLimit"
    WHERE ${now} - "windowStart" > ${LOGIN_WINDOW_SECONDS}
      AND "blockedUntil" <= ${now}
  `;
}

async function getState(key: string): Promise<AttemptState> {
  const now = Math.floor(Date.now() / 1000);
  await ensureRateLimitTable();
  await purgeStaleEntries();

  const rows = await db.$queryRaw<RateLimitRow[]>`
    SELECT
      CAST("count" AS TEXT) AS "count",
      CAST("windowStart" AS TEXT) AS "windowStart",
      CAST("blockedUntil" AS TEXT) AS "blockedUntil"
    FROM "LoginRateLimit"
    WHERE "clientKey" = ${key}
    LIMIT 1
  `;
  const existing = rows[0] ? normalizeState(rows[0]) : undefined;

  if (!existing) {
    const next = { count: 0, windowStart: now, blockedUntil: 0 };
    await db.$executeRaw`
      INSERT INTO "LoginRateLimit" ("clientKey", "count", "windowStart", "blockedUntil")
      VALUES (${key}, ${next.count}, ${next.windowStart}, ${next.blockedUntil})
    `;
    return next;
  }

  if (now - existing.windowStart > LOGIN_WINDOW_SECONDS) {
    existing.count = 0;
    existing.windowStart = now;
    existing.blockedUntil = 0;
    await db.$executeRaw`
      UPDATE "LoginRateLimit"
      SET "count" = ${existing.count},
          "windowStart" = ${existing.windowStart},
          "blockedUntil" = ${existing.blockedUntil}
      WHERE "clientKey" = ${key}
    `;
  }

  return existing;
}

export function getClientKey(ip: string | null): string {
  return ip?.trim() || "unknown";
}

export async function checkLoginRateLimit(key: string): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const state = await getState(key);

  if (state.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: state.blockedUntil - now,
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordFailedLogin(key: string): Promise<{
  blocked: boolean;
  retryAfterSeconds: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const state = await getState(key);

  state.count += 1;

  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    state.blockedUntil = now + LOGIN_BLOCK_SECONDS;
    await db.$executeRaw`
      UPDATE "LoginRateLimit"
      SET "count" = ${state.count},
          "windowStart" = ${state.windowStart},
          "blockedUntil" = ${state.blockedUntil}
      WHERE "clientKey" = ${key}
    `;
    return {
      blocked: true,
      retryAfterSeconds: LOGIN_BLOCK_SECONDS,
    };
  }

  await db.$executeRaw`
    UPDATE "LoginRateLimit"
    SET "count" = ${state.count},
        "windowStart" = ${state.windowStart},
        "blockedUntil" = ${state.blockedUntil}
    WHERE "clientKey" = ${key}
  `;

  return { blocked: false, retryAfterSeconds: 0 };
}

export async function clearLoginRateLimit(key: string): Promise<void> {
  await ensureRateLimitTable();
  await db.$executeRaw`
    DELETE FROM "LoginRateLimit"
    WHERE "clientKey" = ${key}
  `;
}
