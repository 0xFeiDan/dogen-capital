import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidTrade } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteTrade, upsertTrade } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Trade } from "@/types";

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
      !isValidTrade(body.trade) ||
      body.trade.id !== id
    ) {
      return badRequest("Invalid trade payload");
    }

    const trade = await upsertTrade(body.profileId, body.trade as Trade);
    return NextResponse.json({ trade });
  } catch (error) {
    return serverError(error, "Failed to save trade");
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

    await deleteTrade(profileId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Failed to delete trade");
  }
}
