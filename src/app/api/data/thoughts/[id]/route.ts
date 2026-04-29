import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidThought } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteThought, upsertThought } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Thought } from "@/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  try {
    const { id } = await context.params;
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid request body");
    }

    if (
      !isRecord(body) ||
      !isAppUserId(body.profileId) ||
      !isValidThought(body.thought) ||
      body.thought.id !== id
    ) {
      return badRequest("Invalid thought payload");
    }

    const thought = await upsertThought(body.profileId, body.thought as Thought);
    return NextResponse.json({ thought });
  } catch (error) {
    return serverError(error, "Failed to save thought");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!isAppUserId(profileId)) {
      return badRequest("Invalid profile");
    }

    await deleteThought(profileId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Failed to delete thought");
  }
}
