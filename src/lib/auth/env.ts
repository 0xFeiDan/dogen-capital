export function getSessionSecret(): string | undefined {
  const value = process.env.AUTH_SESSION_SECRET?.trim();
  if (!value || value.length < 32) return undefined;
  return value;
}

export function getPasswordHash(): string | undefined {
  const value = process.env.AUTH_PASSWORD_HASH?.trim();
  return value || undefined;
}

export function getSessionTtlSeconds(): number {
  const raw = process.env.AUTH_SESSION_TTL_SECONDS?.trim();
  const parsed = raw ? Number(raw) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 60 * 60 * 12;
  }

  return Math.floor(parsed);
}
