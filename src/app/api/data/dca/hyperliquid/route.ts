import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { loadHypurrscanDcaEntries, normalizeHyperliquidAddress } from "@/lib/hypurrscan-dca";
import {
  getDcaSyncSetting,
  replaceAutoDcaEntriesForAddress,
} from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

interface SyncRequest {
  profileId: string;
  address: string;
  previousAddressToRemove?: string;
}

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
    return NextResponse.json(
      { error: `Load Hyperliquid DCA setting failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  let body: SyncRequest;

  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const address = normalizeHyperliquidAddress(body.address ?? "");
  const previousAddressToRemove =
    (body.previousAddressToRemove
      ? normalizeHyperliquidAddress(body.previousAddressToRemove)
      : undefined) ?? undefined;

  if (!isAppUserId(body.profileId) || !address) {
    return NextResponse.json({ error: "Invalid profile or address" }, { status: 400 });
  }

  if (body.previousAddressToRemove && !previousAddressToRemove) {
    return NextResponse.json({ error: "Invalid previous address" }, { status: 400 });
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
    return NextResponse.json(
      { error: `Sync Hyperliquid DCA failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
