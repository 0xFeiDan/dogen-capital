import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { validateSameOriginRequest } from "@/lib/auth/api";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export async function POST(request: Request) {
  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure:
      forwardedProto === "https" ||
      (!forwardedProto && new URL(request.url).protocol === "https:"),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
