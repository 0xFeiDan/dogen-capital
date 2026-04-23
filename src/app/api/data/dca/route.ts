import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertDcaEntry } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { DcaEntry } from "@/types";

interface SaveDcaEntryRequest {
  profileId: string;
  entry: DcaEntry;
}

function isValidDcaEntry(entry: DcaEntry | undefined): entry is DcaEntry {
  return Boolean(
    entry &&
      typeof entry.id === "string" &&
      entry.id &&
      typeof entry.ticker === "string" &&
      entry.ticker &&
      (entry.side == null || entry.side === "buy" || entry.side === "sell") &&
      (entry.assetClass === "stock" || entry.assetClass === "crypto") &&
      typeof entry.currency === "string" &&
      typeof entry.investedAt === "string" &&
      Number.isFinite(entry.investedAmount) &&
      entry.investedAmount > 0 &&
      Number.isFinite(entry.quantity) &&
      entry.quantity > 0 &&
      typeof entry.createdAt === "string" &&
      typeof entry.updatedAt === "string"
  );
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: SaveDcaEntryRequest;

    try {
      body = (await request.json()) as SaveDcaEntryRequest;
    } catch {
      return NextResponse.json({ error: "\u8bf7\u6c42\u4f53\u65e0\u6548" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !isValidDcaEntry(body.entry)) {
      return NextResponse.json({ error: "\u5b9a\u6295\u6570\u636e\u4e0d\u5b8c\u6574" }, { status: 400 });
    }

    const entry = await upsertDcaEntry(body.profileId, body.entry);
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: `\u4fdd\u5b58\u5b9a\u6295\u8bb0\u5f55\u5931\u8d25: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
