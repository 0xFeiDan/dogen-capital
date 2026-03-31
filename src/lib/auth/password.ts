import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "s1";
const KEY_LENGTH = 64;

export function generatePasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}:${salt}:${derived}`;
}

export function verifyPassword(
  password: string,
  storedHash: string | undefined
): boolean {
  if (!storedHash) return false;

  const [prefix, salt, expectedHex] = storedHash.split(":");
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
