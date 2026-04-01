import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";
import { getSessionSecret } from "./env";
import { verifySessionToken } from "./session";

export async function requireAuthenticatedApiRequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token, getSessionSecret());

  if (!valid) {
    return NextResponse.json({ error: "未登录或会话已失效" }, { status: 401 });
  }

  return null;
}

export async function validateSameOriginRequest(request: Request) {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");

  if (!origin || !host) {
    return null;
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "非法请求来源" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "非法请求来源" }, { status: 403 });
  }

  return null;
}
