import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";
import { getServerSnapshot } from "@/lib/server-data";

export async function GET() {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  const snapshot = await getServerSnapshot();
  return NextResponse.json(snapshot);
}
