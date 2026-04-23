import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteDcaEntry, upsertDcaEntry } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { DcaEntry } from "@/types";

interface UpdateDcaEntryRequest {
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
      (entry.assetClass === "stock" || entry.assetClass === "crypto") &&
      typeof entry.currency === "string" &&
      typeof entry.investedAt === "string" &&
      Number.isFinite(entry.investedAmount) &&
      entry.investedAmount > 0 &&
      Number.isFinite(entry.quantity) &&
      entry.quantity > 0 &&
      (entry.takeProfitMode == null ||
        entry.takeProfitMode === "price" ||
        entry.takeProfitMode === "percent") &&
      (entry.takeProfitPrice == null ||
        (Number.isFinite(entry.takeProfitPrice) && entry.takeProfitPrice > 0)) &&
      (entry.takeProfitPercent == null ||
        (Number.isFinite(entry.takeProfitPercent) && entry.takeProfitPercent > 0)) &&
      typeof entry.createdAt === "string" &&
      typeof entry.updatedAt === "string"
  );
}

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
    let body: UpdateDcaEntryRequest;

    try {
      body = (await request.json()) as UpdateDcaEntryRequest;
    } catch {
      return NextResponse.json({ error: "\u8bf7\u6c42\u4f53\u65e0\u6548" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !isValidDcaEntry(body.entry) || body.entry.id !== id) {
      return NextResponse.json({ error: "\u5b9a\u6295\u6570\u636e\u4e0d\u5b8c\u6574" }, { status: 400 });
    }

    const entry = await upsertDcaEntry(body.profileId, body.entry);
    return NextResponse.json({ entry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "\u4fdd\u5b58\u5b9a\u6295\u8bb0\u5f55\u5931\u8d25";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message =
      error instanceof Error ? error.message : "\u5220\u9664\u5b9a\u6295\u8bb0\u5f55\u5931\u8d25";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
