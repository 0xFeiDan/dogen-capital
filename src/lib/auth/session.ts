import { DEFAULT_SESSION_TTL_SECONDS } from "./constants";

interface SessionPayload {
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(
  secret: string,
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS
): Promise<string> {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payloadValue = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await signValue(payloadValue, secret);

  return `${payloadValue}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!token || !secret) return false;

  const [payloadValue, signatureValue] = token.split(".");
  if (!payloadValue || !signatureValue) return false;

  try {
    const key = await importHmacKey(secret);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signatureValue),
      new TextEncoder().encode(payloadValue)
    );

    if (!validSignature) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(new Uint8Array(fromBase64Url(payloadValue)))
    ) as SessionPayload;

    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
