import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { deleteTrade, upsertTrade } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";
import type { Trade } from "@/types";

interface UpdateTradeRequest {
  profileId: string;
  trade: Trade;
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
    let body: UpdateTradeRequest;

    try {
      body = (await request.json()) as UpdateTradeRequest;
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !body.trade || body.trade.id !== id) {
      return NextResponse.json({ error: "交易数据不完整" }, { status: 400 });
    }

    const trade = await upsertTrade(body.profileId, body.trade);
    return NextResponse.json({ trade });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存交易失败";
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
      return NextResponse.json({ error: "用户信息无效" }, { status: 400 });
    }

    await deleteTrade(profileId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除交易失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
