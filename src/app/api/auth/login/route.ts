import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { badRequest, forbidden, serverError } from "@/lib/api/response";
import { isNonEmptyString, isRecord } from "@/lib/api/validation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getPasswordHash, getSessionSecret, getSessionTtlSeconds } from "@/lib/auth/env";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getClientKey,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const origin = headerStore.get("origin");
    const host = headerStore.get("host");
    const forwardedProto = headerStore.get("x-forwarded-proto");

    if (!origin || !host) {
      return forbidden();
    }

    if (new URL(origin).host !== host) {
      return forbidden();
    }

    const sessionSecret = getSessionSecret();
    const passwordHash = getPasswordHash();

    if (!sessionSecret || !passwordHash) {
      return serverError("Auth env missing", "Authentication is not configured");
    }

    const forwardedFor = headerStore.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim() ?? null;
    const clientKey = getClientKey(clientIp);
    const rateLimit = await checkLoginRateLimit(clientKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid request body");
    }

    if (!isRecord(body) || !isNonEmptyString(body.password)) {
      return badRequest("Password is required");
    }

    const valid = verifyPassword(body.password.trim(), passwordHash);

    if (!valid) {
      const failed = await recordFailedLogin(clientKey);
      const message = failed.blocked
        ? `Too many attempts. Try again in ${Math.ceil(failed.retryAfterSeconds / 60)} minutes.`
        : "Invalid password";

      return NextResponse.json({ error: message }, { status: failed.blocked ? 429 : 401 });
    }

    await clearLoginRateLimit(clientKey);

    const token = await createSessionToken(sessionSecret, getSessionTtlSeconds());
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure:
        forwardedProto === "https" ||
        (!forwardedProto && new URL(request.url).protocol === "https:"),
      sameSite: "strict",
      path: "/",
      maxAge: getSessionTtlSeconds(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Login failed");
  }
}
