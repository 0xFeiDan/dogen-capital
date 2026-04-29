import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidLivePriceUpdate } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { updateTradeCurrentPrices } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

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

    if (!isRecord(body) || !isAppUserId(body.profileId) || !Array.isArray(body.updates)) {
      return badRequest("Invalid live price payload");
    }

    if (!body.updates.every((update) => isValidLivePriceUpdate(update))) {
      return badRequest("Invalid live price payload");
    }

    const count = await updateTradeCurrentPrices(body.profileId, body.updates);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return serverError(error, "Failed to update trade live prices");
  }
}
