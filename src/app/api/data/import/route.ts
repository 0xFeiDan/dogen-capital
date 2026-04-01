import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { jsonToThoughts, jsonToTrades } from "@/lib/io";
import {
  importBackup,
  importThoughtsForProfile,
  importTradesForProfile,
  type SettingsByUser,
  type ThoughtsByUser,
  type TradesByUser,
} from "@/lib/server-data";
import { APP_USERS, isAppUserId } from "@/lib/users";

type ImportMode = "merge" | "overwrite";

interface ImportItemsRequest {
  format: "trades-json" | "trades-csv" | "thoughts-json";
  mode: ImportMode;
  profileId: string;
  items: unknown[];
}

interface ImportBackupRequest {
  format: "backup-json";
  mode: ImportMode;
  payload: {
    tradesByUser: Partial<TradesByUser>;
    thoughtsByUser: Partial<ThoughtsByUser>;
    settingsByUser: Partial<SettingsByUser>;
  };
}

type ImportRequest = ImportItemsRequest | ImportBackupRequest;

function normalizeSettingsByUser(source: Partial<SettingsByUser>): SettingsByUser {
  return {
    me: {
      initialCapital: Number(source.me?.initialCapital ?? 100000),
    },
    partner: {
      initialCapital: Number(source.partner?.initialCapital ?? 100000),
    },
  };
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: ImportRequest;

    try {
      body = (await request.json()) as ImportRequest;
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    if (body.format === "backup-json") {
      const tradesByUser = {} as TradesByUser;
      const thoughtsByUser = {} as ThoughtsByUser;

      for (const user of APP_USERS) {
        const tradesResult = jsonToTrades(
          JSON.stringify(body.payload.tradesByUser?.[user.id] ?? [])
        );
        const thoughtsResult = jsonToThoughts(
          JSON.stringify(body.payload.thoughtsByUser?.[user.id] ?? [])
        );

        if (tradesResult.errors.length > 0 || thoughtsResult.errors.length > 0) {
          return NextResponse.json(
            {
              error:
                tradesResult.errors[0] ??
                thoughtsResult.errors[0] ??
                "备份文件内容无效",
            },
            { status: 400 }
          );
        }

        tradesByUser[user.id] = tradesResult.data;
        thoughtsByUser[user.id] = thoughtsResult.data;
      }

      await importBackup(
        {
          tradesByUser,
          thoughtsByUser,
          settingsByUser: normalizeSettingsByUser(body.payload.settingsByUser ?? {}),
        },
        body.mode
      );

      return NextResponse.json({ ok: true });
    }

    if (!isAppUserId(body.profileId) || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "导入参数无效" }, { status: 400 });
    }

    if (body.format === "thoughts-json") {
      const result = jsonToThoughts(JSON.stringify(body.items));
      if (result.errors.length > 0) {
        return NextResponse.json({ error: result.errors[0] }, { status: 400 });
      }

      await importThoughtsForProfile(body.profileId, result.data, body.mode);
      return NextResponse.json({ ok: true, count: result.data.length });
    }

    const result = jsonToTrades(JSON.stringify(body.items));
    if (result.errors.length > 0) {
      return NextResponse.json({ error: result.errors[0] }, { status: 400 });
    }

    await importTradesForProfile(body.profileId, result.data, body.mode);
    return NextResponse.json({ ok: true, count: result.data.length });
  } catch (error) {
    return NextResponse.json(
      { error: `导入数据失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
