import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isPositiveNumber, isRecord } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { updateInitialCapital } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

export async function PATCH(request: Request) {
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

    if (!isRecord(body) || !isAppUserId(body.profileId) || !isPositiveNumber(body.initialCapital)) {
      return badRequest("Invalid initial capital");
    }

    const setting = await updateInitialCapital(body.profileId, body.initialCapital);
    return NextResponse.json({ setting });
  } catch (error) {
    return serverError(error, "Failed to update initial capital");
  }
}
