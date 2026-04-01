import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertThought } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Thought } from "@/types";

interface SaveThoughtRequest {
  profileId: string;
  thought: Thought;
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  let body: SaveThoughtRequest;

  try {
    body = (await request.json()) as SaveThoughtRequest;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  if (!isAppUserId(body.profileId) || !body.thought?.id || !body.thought?.title) {
    return NextResponse.json({ error: "笔记数据不完整" }, { status: 400 });
  }

  const thought = await upsertThought(body.profileId, body.thought);
  return NextResponse.json({ thought });
}
