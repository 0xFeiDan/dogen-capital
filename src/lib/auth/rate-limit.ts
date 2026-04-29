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

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let lastCleanup = Date.now();
let setupPromise: Promise<void> | null = null;

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
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  await db.$executeRaw`
    DELETE FROM "LoginRateLimit"
    WHERE ${now} - "windowStart" > ${LOGIN_WINDOW_MS}
      AND "blockedUntil" <= ${now}
  `;
}

async function getState(key: string): Promise<AttemptState> {
  const now = Date.now();
  await ensureRateLimitTable();
  await purgeStaleEntries();

  const rows = await db.$queryRaw<Array<{
    count: number;
    windowStart: number;
    blockedUntil: number;
  }>>`
    SELECT "count", "windowStart", "blockedUntil"
    FROM "LoginRateLimit"
    WHERE "clientKey" = ${key}
    LIMIT 1
  `;
  const existing = rows[0];

  if (!existing) {
    const next = { count: 0, windowStart: now, blockedUntil: 0 };
    await db.$executeRaw`
      INSERT INTO "LoginRateLimit" ("clientKey", "count", "windowStart", "blockedUntil")
      VALUES (${key}, ${next.count}, ${next.windowStart}, ${next.blockedUntil})
    `;
    return next;
  }

  if (now - existing.windowStart > LOGIN_WINDOW_MS) {
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
  const now = Date.now();
  const state = await getState(key);

  if (state.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordFailedLogin(key: string): Promise<{
  blocked: boolean;
  retryAfterSeconds: number;
}> {
  const now = Date.now();
  const state = await getState(key);

  state.count += 1;

  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    state.blockedUntil = now + LOGIN_BLOCK_MS;
    await db.$executeRaw`
      UPDATE "LoginRateLimit"
      SET "count" = ${state.count},
          "windowStart" = ${state.windowStart},
          "blockedUntil" = ${state.blockedUntil}
      WHERE "clientKey" = ${key}
    `;
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(LOGIN_BLOCK_MS / 1000),
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
