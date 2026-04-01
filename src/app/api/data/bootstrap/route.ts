import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";
import { getServerSnapshot } from "@/lib/server-data";

export async function GET() {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const snapshot = await getServerSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: `服务器同步初始化失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
