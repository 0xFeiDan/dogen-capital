import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { upsertTrade } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Trade } from "@/types";

interface SaveTradeRequest {
  profileId: string;
  trade: Trade;
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: SaveTradeRequest;

    try {
      body = (await request.json()) as SaveTradeRequest;
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !body.trade?.id || !body.trade?.ticker) {
      return NextResponse.json({ error: "交易数据不完整" }, { status: 400 });
    }

    const trade = await upsertTrade(body.profileId, body.trade);
    return NextResponse.json({ trade });
  } catch (error) {
    return NextResponse.json(
      { error: `保存交易失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
