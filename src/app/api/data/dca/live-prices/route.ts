import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { updateDcaCurrentPrices } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

interface DcaLivePricesRequest {
  profileId: string;
  updates?: Array<{
    id: string;
    currentPrice: number;
    quoteSymbol?: string;
    quoteCurrency?: string;
    priceUpdatedAt?: string;
  }>;
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const originError = await validateSameOriginRequest(request);
  if (originError) return originError;

  let body: DcaLivePricesRequest;

  try {
    body = (await request.json()) as DcaLivePricesRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isAppUserId(body.profileId) || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Invalid live price payload" }, { status: 400 });
  }

  try {
    const count = await updateDcaCurrentPrices(body.profileId, body.updates);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update DCA live prices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
