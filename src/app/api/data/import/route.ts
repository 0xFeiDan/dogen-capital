import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { jsonToDcaEntries, jsonToThoughts, jsonToTrades } from "@/lib/io";
import {
  importBackup,
  importDcaEntriesForProfile,
  importThoughtsForProfile,
  importTradesForProfile,
  type DcaByUser,
  type SettingsByUser,
  type ThoughtsByUser,
  type TradesByUser,
} from "@/lib/server-data";
import { APP_USERS, isAppUserId } from "@/lib/users";
import type { DcaEntry } from "@/types";

type ImportMode = "merge" | "overwrite";
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function normalizeMode(value: unknown): ImportMode {
  return value === "overwrite" ? "overwrite" : "merge";
}

function normalizeInitialCapital(value: unknown): number {
  const amount = Number(value ?? 100000);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid initial capital");
  }

  return Math.round(amount * 100) / 100;
}

function normalizeSettingsByUser(source: Partial<SettingsByUser>): SettingsByUser {
  return {
    me: {
      initialCapital: normalizeInitialCapital(source.me?.initialCapital),
    },
    partner: {
      initialCapital: normalizeInitialCapital(source.partner?.initialCapital),
    },
  };
}

function parseDcaEntries(value: unknown): DcaEntry[] {
  const result = jsonToDcaEntries(JSON.stringify(Array.isArray(value) ? value : []));
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]);
  }
  return result.data;
}

function normalizeDcaByUser(source: Partial<DcaByUser>): DcaByUser {
  return {
    me: parseDcaEntries(source.me),
    partner: parseDcaEntries(source.partner),
  };
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Import payload is too large" }, { status: 413 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid request body");
    }

    if (!isRecord(body) || typeof body.format !== "string") {
      return badRequest("Invalid import payload");
    }

    const mode = normalizeMode(body.mode);

    if (body.format === "backup-json") {
      if (!isRecord(body.payload)) {
        return badRequest("Invalid backup payload");
      }

      const payload = body.payload as {
        tradesByUser?: Partial<TradesByUser>;
        thoughtsByUser?: Partial<ThoughtsByUser>;
        dcaByUser?: Partial<DcaByUser>;
        settingsByUser?: Partial<SettingsByUser>;
      };
      const tradesByUser = {} as TradesByUser;
      const thoughtsByUser = {} as ThoughtsByUser;
      let dcaByUser: DcaByUser;
      let settingsByUser: SettingsByUser;

      for (const user of APP_USERS) {
        const tradesResult = jsonToTrades(
          JSON.stringify(payload.tradesByUser?.[user.id] ?? [])
        );
        const thoughtsResult = jsonToThoughts(
          JSON.stringify(payload.thoughtsByUser?.[user.id] ?? [])
        );

        if (tradesResult.errors.length > 0 || thoughtsResult.errors.length > 0) {
          return badRequest(
            tradesResult.errors[0] ?? thoughtsResult.errors[0] ?? "Invalid backup payload"
          );
        }

        tradesByUser[user.id] = tradesResult.data;
        thoughtsByUser[user.id] = thoughtsResult.data;
      }

      try {
        dcaByUser = normalizeDcaByUser(payload.dcaByUser ?? {});
        settingsByUser = normalizeSettingsByUser(payload.settingsByUser ?? {});
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid backup payload");
      }

      await importBackup(
        {
          tradesByUser,
          thoughtsByUser,
          dcaByUser,
          settingsByUser,
        },
        mode
      );

      return NextResponse.json({ ok: true });
    }

    if (!isAppUserId(body.profileId) || !Array.isArray(body.items)) {
      return badRequest("Invalid import payload");
    }

    if (body.format === "thoughts-json") {
      const result = jsonToThoughts(JSON.stringify(body.items));
      if (result.errors.length > 0) return badRequest(result.errors[0]);

      await importThoughtsForProfile(body.profileId, result.data, mode);
      return NextResponse.json({ ok: true, count: result.data.length });
    }

    if (body.format === "dca-json") {
      const result = jsonToDcaEntries(JSON.stringify(body.items));
      if (result.errors.length > 0) return badRequest(result.errors[0]);

      await importDcaEntriesForProfile(body.profileId, result.data, mode);
      return NextResponse.json({ ok: true, count: result.data.length });
    }

    if (body.format === "trades-json" || body.format === "trades-csv") {
      const result = jsonToTrades(JSON.stringify(body.items));
      if (result.errors.length > 0) return badRequest(result.errors[0]);

      await importTradesForProfile(body.profileId, result.data, mode);
      return NextResponse.json({ ok: true, count: result.data.length });
    }

    return badRequest("Invalid import format");
  } catch (error) {
    return serverError(error, "Failed to import data");
  }
}
