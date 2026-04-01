import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteThought, upsertThought } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Thought } from "@/types";

interface UpdateThoughtRequest {
  profileId: string;
  thought: Thought;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  const { id } = await context.params;
  let body: UpdateThoughtRequest;

  try {
    body = (await request.json()) as UpdateThoughtRequest;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  if (!isAppUserId(body.profileId) || !body.thought || body.thought.id !== id) {
    return NextResponse.json({ error: "笔记数据不完整" }, { status: 400 });
  }

  const thought = await upsertThought(body.profileId, body.thought);
  return NextResponse.json({ thought });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!isAppUserId(profileId)) {
    return NextResponse.json({ error: "用户信息无效" }, { status: 400 });
  }

  await deleteThought(profileId, id);
  return NextResponse.json({ ok: true });
}
