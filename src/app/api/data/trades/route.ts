import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidTrade } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertTrade } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Trade } from "@/types";

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid request body");
    }

    if (!isRecord(body) || !isAppUserId(body.profileId) || !isValidTrade(body.trade)) {
      return badRequest("Invalid trade payload");
    }

    const trade = await upsertTrade(body.profileId, body.trade as Trade);
    return NextResponse.json({ trade });
  } catch (error) {
    return serverError(error, "Failed to save trade");
  }
}
