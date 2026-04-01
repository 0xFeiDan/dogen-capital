import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { updateInitialCapital } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

interface UpdateSettingsRequest {
  profileId: string;
  initialCapital: number;
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: UpdateSettingsRequest;

    try {
      body = (await request.json()) as UpdateSettingsRequest;
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    if (!isAppUserId(body.profileId) || !Number.isFinite(body.initialCapital)) {
      return NextResponse.json({ error: "本金数据无效" }, { status: 400 });
    }

    const setting = await updateInitialCapital(body.profileId, body.initialCapital);
    return NextResponse.json({ setting });
  } catch (error) {
    return NextResponse.json(
      { error: `更新本金失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
