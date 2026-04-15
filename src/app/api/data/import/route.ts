import { NextResponse } from "next/server";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import { jsonToThoughts, jsonToTrades } from "@/lib/io";
import {
  importBackup,
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
    dcaByUser: Partial<DcaByUser>;
    settingsByUser: Partial<SettingsByUser>;
  };
}

type ImportRequest = ImportItemsRequest | ImportBackupRequest;

function normalizeInitialCapital(value: unknown, userLabel: string): number {
  const amount = Number(value ?? 100000);

  if (!Number.isFinite(amount)) {
    throw new Error(`${userLabel} 的本金无效`);
  }

  return Math.round(Math.max(amount, 0) * 100) / 100;
}

function normalizeSettingsByUser(source: Partial<SettingsByUser>): SettingsByUser {
  return {
    me: {
      initialCapital: normalizeInitialCapital(source.me?.initialCapital, "我"),
    },
    partner: {
      initialCapital: normalizeInitialCapital(source.partner?.initialCapital, "女朋友"),
    },
  };
}

function parseDcaEntries(value: unknown, userId: keyof DcaByUser): DcaEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`${userId} 的定投记录第 ${index + 1} 项无效`);
    }

    const entry = item as Partial<DcaEntry>;

    if (
      typeof entry.id !== "string" ||
      typeof entry.ticker !== "string" ||
      (entry.assetClass !== "stock" && entry.assetClass !== "crypto") ||
      typeof entry.currency !== "string" ||
      typeof entry.investedAt !== "string" ||
      typeof entry.investedAmount !== "number" ||
      !Number.isFinite(entry.investedAmount) ||
      entry.investedAmount <= 0 ||
      typeof entry.quantity !== "number" ||
      !Number.isFinite(entry.quantity) ||
      entry.quantity <= 0 ||
      typeof entry.createdAt !== "string" ||
      typeof entry.updatedAt !== "string"
    ) {
      throw new Error(`${userId} 的定投记录第 ${index + 1} 项无效`);
    }

    return [
      {
        id: entry.id,
        ticker: entry.ticker.trim().toUpperCase(),
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : undefined,
        assetClass: entry.assetClass,
        currency: entry.currency,
        investedAt: entry.investedAt,
        investedAmount: entry.investedAmount,
        quantity: entry.quantity,
        notes:
          typeof entry.notes === "string" && entry.notes.trim()
            ? entry.notes.trim()
            : undefined,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    ];
  });
}

function normalizeDcaByUser(source: Partial<DcaByUser>): DcaByUser {
  return {
    me: parseDcaEntries(source.me, "me"),
    partner: parseDcaEntries(source.partner, "partner"),
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
      if (typeof body.payload !== "object" || body.payload === null) {
        return NextResponse.json({ error: "备份文件内容无效" }, { status: 400 });
      }

      const tradesByUser = {} as TradesByUser;
      const thoughtsByUser = {} as ThoughtsByUser;
      let dcaByUser: DcaByUser;
      let settingsByUser: SettingsByUser;

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

      try {
        dcaByUser = normalizeDcaByUser(body.payload.dcaByUser ?? {});
        settingsByUser = normalizeSettingsByUser(body.payload.settingsByUser ?? {});
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "备份文件内容无效" },
          { status: 400 }
        );
      }

      await importBackup(
        {
          tradesByUser,
          thoughtsByUser,
          dcaByUser,
          settingsByUser,
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
