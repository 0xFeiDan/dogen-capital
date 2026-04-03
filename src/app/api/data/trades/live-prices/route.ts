import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { updateTradeCurrentPrices } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

interface UpdateTradeLivePricesRequest {
  profileId: string;
  updates: Array<{ id: string; currentPrice: number }>;
}

function isValidLivePriceUpdate(value: unknown): value is { id: string; currentPrice: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const update = value as { id?: unknown; currentPrice?: unknown };

  return (
    typeof update.id === "string" &&
    update.id.length > 0 &&
    typeof update.currentPrice === "number" &&
    Number.isFinite(update.currentPrice) &&
    update.currentPrice > 0
  );
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: UpdateTradeLivePricesRequest;

    try {
      body = (await request.json()) as UpdateTradeLivePricesRequest;
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !Array.isArray(body.updates)) {
      return NextResponse.json({ error: "实时价格数据无效" }, { status: 400 });
    }

    if (!body.updates.every((update) => isValidLivePriceUpdate(update))) {
      return NextResponse.json({ error: "实时价格数据无效" }, { status: 400 });
    }

    const count = await updateTradeCurrentPrices(body.profileId, body.updates);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json(
      { error: `更新实时价格失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
