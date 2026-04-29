import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isNonEmptyString } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { loadHypurrscanDcaEntries, normalizeHyperliquidAddress } from "@/lib/hypurrscan-dca";
import {
  getDcaSyncSetting,
  replaceAutoDcaEntriesForAddress,
} from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

export async function GET(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!isAppUserId(profileId)) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }

  try {
    const setting = await getDcaSyncSetting(profileId, "hyperliquid");
    return NextResponse.json({ setting });
  } catch (error) {
    return serverError(error, "Failed to load Hyperliquid DCA setting");
  }
}

export async function POST(request: Request) {
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

  if (!isRecord(body)) {
    return badRequest("Invalid sync payload");
  }

  const address = normalizeHyperliquidAddress(String(body.address ?? ""));
  const previousAddressToRemove =
    (isNonEmptyString(body.previousAddressToRemove)
      ? normalizeHyperliquidAddress(body.previousAddressToRemove)
      : undefined) ?? undefined;

  if (!isAppUserId(body.profileId) || !address) {
    return badRequest("Invalid profile or address");
  }

  if (body.previousAddressToRemove && !previousAddressToRemove) {
    return badRequest("Invalid previous address");
  }

  try {
    const imported = await loadHypurrscanDcaEntries(address);
    const result = await replaceAutoDcaEntriesForAddress({
      profileId: body.profileId,
      provider: "hyperliquid",
      address,
      previousAddressToRemove,
      entries: imported.entries,
    });

    return NextResponse.json({
      ...result,
      sourceUrl: imported.sourceUrl,
    });
  } catch (error) {
    return serverError(error, "Sync Hyperliquid DCA failed");
  }
}
