import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidDcaEntry } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteDcaEntry, upsertDcaEntry } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { DcaEntry } from "@/types";

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
      !isValidDcaEntry(body.entry) ||
      body.entry.id !== id
    ) {
      return badRequest("Invalid DCA entry payload");
    }

    const entry = await upsertDcaEntry(body.profileId, body.entry as DcaEntry);
    return NextResponse.json({ entry });
  } catch (error) {
    return serverError(error, "Failed to save DCA entry");
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
      return NextResponse.json({ error: "\u7528\u6237\u4fe1\u606f\u65e0\u6548" }, { status: 400 });
    }

    await deleteDcaEntry(profileId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Failed to delete DCA entry");
  }
}
