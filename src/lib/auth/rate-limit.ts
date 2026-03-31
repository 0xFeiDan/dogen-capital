import {
  LOGIN_BLOCK_MS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
} from "./constants";

interface AttemptState {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptState>();

function getState(key: string): AttemptState {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing) {
    const next = { count: 0, windowStart: now, blockedUntil: 0 };
    attempts.set(key, next);
    return next;
  }

  if (now - existing.windowStart > LOGIN_WINDOW_MS) {
    existing.count = 0;
    existing.windowStart = now;
  }

  return existing;
}

export function getClientKey(ip: string | null): string {
  return ip?.trim() || "unknown";
}

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const state = getState(key);

  if (state.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const state = getState(key);

  state.count += 1;

  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    state.blockedUntil = now + LOGIN_BLOCK_MS;
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(LOGIN_BLOCK_MS / 1000),
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function clearLoginRateLimit(key: string): void {
  attempts.delete(key);
}
