import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
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
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");

  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "非法请求来源" }, { status: 403 });
    }
  }

  const sessionSecret = getSessionSecret();
  const passwordHash = getPasswordHash();

  if (!sessionSecret || !passwordHash) {
    return NextResponse.json(
      { error: "服务端尚未完成安全配置" },
      { status: 500 }
    );
  }

  const forwardedFor = headerStore.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? null;
  const clientKey = getClientKey(clientIp);
  const rateLimit = checkLoginRateLimit(clientKey);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `尝试次数过多，请在 ${Math.ceil(rateLimit.retryAfterSeconds / 60)} 分钟后重试`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  let password = "";

  try {
    const body = (await request.json()) as { password?: string };
    password = body.password?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "请输入密码" }, { status: 400 });
  }

  const valid = verifyPassword(password, passwordHash);

  if (!valid) {
    const failed = recordFailedLogin(clientKey);
    const message = failed.blocked
      ? `错误次数过多，请在 ${Math.ceil(failed.retryAfterSeconds / 60)} 分钟后重试`
      : "密码错误";

    return NextResponse.json({ error: message }, { status: failed.blocked ? 429 : 401 });
  }

  clearLoginRateLimit(clientKey);

  const token = await createSessionToken(sessionSecret, getSessionTtlSeconds());
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return NextResponse.json({ ok: true });
}
