import { NextResponse } from "next/server";
import { serverError } from "@/lib/api/response";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";
import { getServerSnapshot } from "@/lib/server-data";

export async function GET() {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const snapshot = await getServerSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return serverError(error, "Server sync initialization failed");
  }
}
