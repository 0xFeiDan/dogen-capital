import { NextResponse } from "next/server";
import { serverError } from "@/lib/api/response";
import {
  dcaEntriesToJSON,
  thoughtsToJSON,
  todayStamp,
  tradesToCSV,
  tradesToJSON,
} from "@/lib/io";
import { requireAuthenticatedApiRequest } from "@/lib/auth/api";
import { createServerBackup, getServerSnapshot } from "@/lib/server-data";
import { isAppUserId } from "@/lib/users";

type ExportType =
  | "backup-json"
  | "trades-json"
  | "trades-csv"
  | "thoughts-json"
  | "dca-json";

function attachmentHeaders(filename: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}

export async function GET(request: Request) {
  const authError = await requireAuthenticatedApiRequest();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ExportType | null;
    const profileId = searchParams.get("profileId");
    const stamp = todayStamp();

    if (!type) {
      return NextResponse.json({ error: "Missing export type" }, { status: 400 });
    }

    if (type === "backup-json") {
      const backup = await createServerBackup();
      return new Response(JSON.stringify(backup, null, 2), {
        status: 200,
        headers: attachmentHeaders(`dogen-backup-${stamp}.json`, "application/json"),
      });
    }

    if (!isAppUserId(profileId)) {
      return NextResponse.json({ error: "Missing valid profile" }, { status: 400 });
    }

    const snapshot = await getServerSnapshot();

    if (type === "trades-json") {
      return new Response(tradesToJSON(snapshot.tradesByUser[profileId]), {
        status: 200,
        headers: attachmentHeaders(`dogen-trades-${profileId}-${stamp}.json`, "application/json"),
      });
    }

    if (type === "trades-csv") {
      return new Response(tradesToCSV(snapshot.tradesByUser[profileId]), {
        status: 200,
        headers: attachmentHeaders(`dogen-trades-${profileId}-${stamp}.csv`, "text/csv"),
      });
    }

    if (type === "thoughts-json") {
      return new Response(thoughtsToJSON(snapshot.thoughtsByUser[profileId]), {
        status: 200,
        headers: attachmentHeaders(
          `dogen-thoughts-${profileId}-${stamp}.json`,
          "application/json"
        ),
      });
    }

    if (type === "dca-json") {
      return new Response(dcaEntriesToJSON(snapshot.dcaByUser[profileId]), {
        status: 200,
        headers: attachmentHeaders(`dogen-dca-${profileId}-${stamp}.json`, "application/json"),
      });
    }

    return NextResponse.json({ error: "Unsupported export type" }, { status: 400 });
  } catch (error) {
    return serverError(error, "Server export failed");
  }
}
