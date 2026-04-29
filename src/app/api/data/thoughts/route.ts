import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidThought } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertThought } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Thought } from "@/types";

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

    if (!isRecord(body) || !isAppUserId(body.profileId) || !isValidThought(body.thought)) {
      return badRequest("Invalid thought payload");
    }

    const thought = await upsertThought(body.profileId, body.thought as Thought);
    return NextResponse.json({ thought });
  } catch (error) {
    return serverError(error, "Failed to save thought");
  }
}
