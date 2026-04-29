import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidDcaEntry } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertDcaEntry } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { DcaEntry } from "@/types";

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

    if (!isRecord(body) || !isAppUserId(body.profileId) || !isValidDcaEntry(body.entry)) {
      return badRequest("Invalid DCA entry payload");
    }

    const entry = await upsertDcaEntry(body.profileId, body.entry as DcaEntry);
    return NextResponse.json({ entry });
  } catch (error) {
    return serverError(error, "Failed to save DCA entry");
  }
}
