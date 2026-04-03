import type { Thought, Trade } from "@/types";
import { db } from "@/lib/db";
import { normalizeTrade } from "@/lib/pricing";
import { APP_USERS, type AppUserId, type AppUserProfile, isAppUserId } from "@/lib/users";

const DEFAULT_INITIAL_CAPITAL = 100000;

async function ensureDatabaseSchema() {
  await db.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Profile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TradeRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "ticker" TEXT NOT NULL,
      "name" TEXT,
      "pricingMode" TEXT,
      "binanceMarketType" TEXT,
      "binanceSymbol" TEXT,
      "direction" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "assetClass" TEXT NOT NULL,
      "currency" TEXT NOT NULL,
      "entryDate" TEXT NOT NULL,
      "exitDate" TEXT,
      "entryPrice" REAL NOT NULL,
      "exitPrice" REAL,
      "currentPrice" REAL,
      "quantity" REAL NOT NULL,
      "fees" REAL NOT NULL,
      "setupType" TEXT,
      "tagsJson" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT "TradeRecord_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profile" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ThoughtRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "tagsJson" TEXT NOT NULL,
      "ticker" TEXT,
      "isPrivate" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT "ThoughtRecord_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profile" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PortfolioSetting" (
      "profileId" TEXT NOT NULL PRIMARY KEY,
      "initialCapital" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PortfolioSetting_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profile" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TradeRecord_profileId_status_idx"
    ON "TradeRecord" ("profileId", "status")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TradeRecord_profileId_exitDate_idx"
    ON "TradeRecord" ("profileId", "exitDate")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TradeRecord_profileId_updatedAt_idx"
    ON "TradeRecord" ("profileId", "updatedAt")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ThoughtRecord_profileId_category_idx"
    ON "ThoughtRecord" ("profileId", "category")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ThoughtRecord_profileId_updatedAt_idx"
    ON "ThoughtRecord" ("profileId", "updatedAt")
  `);

  const tradeColumns = await db.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("TradeRecord")`
  );
  const tradeColumnNames = new Set(tradeColumns.map((column) => column.name));

  if (!tradeColumnNames.has("pricingMode")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "TradeRecord" ADD COLUMN "pricingMode" TEXT`
    );
  }

  if (!tradeColumnNames.has("binanceMarketType")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "TradeRecord" ADD COLUMN "binanceMarketType" TEXT`
    );
  }

  if (!tradeColumnNames.has("binanceSymbol")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "TradeRecord" ADD COLUMN "binanceSymbol" TEXT`
    );
  }
}

async function ensureProfiles() {
  await Promise.all(
    APP_USERS.map(async (user) => {
      await db.profile.upsert({
        where: { id: user.id },
        update: { name: user.name },
        create: {
          id: user.id,
          name: user.name,
          setting: {
            create: {
              initialCapital: DEFAULT_INITIAL_CAPITAL,
            },
          },
        },
      });

      await db.portfolioSetting.upsert({
        where: { profileId: user.id },
        update: {},
        create: {
          profileId: user.id,
          initialCapital: DEFAULT_INITIAL_CAPITAL,
        },
      });
    })
  );
}

let setupPromise: Promise<void> | null = null;

export type TradesByUser = Record<AppUserId, Trade[]>;
export type ThoughtsByUser = Record<AppUserId, Thought[]>;
export type SettingsByUser = Record<AppUserId, { initialCapital: number }>;

export interface ServerSnapshot {
  profiles: AppUserProfile[];
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  settingsByUser: SettingsByUser;
  serverHasData: boolean;
  syncedAt: string;
}

export interface ServerBackupPayload extends ServerSnapshot {
  version: 1;
  type: "multi-user-backup";
  exportedAt: string;
}

function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

function deserializeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeCapital(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_INITIAL_CAPITAL;
  }

  return Math.round(Math.max(value, 0) * 100) / 100;
}

function normalizeCapitalForWrite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("本金数据无效");
  }

  return normalizeCapital(value);
}

function toScopedId(profileId: AppUserId, id: string): string {
  return `${profileId}:${id}`;
}

function fromScopedId(profileId: AppUserId, id: string): string {
  const prefix = `${profileId}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function buildEmptyTradesByUser(): TradesByUser {
  return {
    me: [],
    partner: [],
  };
}

function buildEmptyThoughtsByUser(): ThoughtsByUser {
  return {
    me: [],
    partner: [],
  };
}

function buildDefaultSettingsByUser(): SettingsByUser {
  return {
    me: { initialCapital: DEFAULT_INITIAL_CAPITAL },
    partner: { initialCapital: DEFAULT_INITIAL_CAPITAL },
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const merged = new Map(current.map((item) => [item.id, item] as const));

  for (const item of incoming) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

export async function ensureServerSetup() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await ensureDatabaseSchema();
      await ensureProfiles();
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

function toTrade(record: {
  id: string;
  profileId: string;
  ticker: string;
  name: string | null;
  pricingMode: string | null;
  binanceMarketType: string | null;
  binanceSymbol: string | null;
  direction: string;
  status: string;
  assetClass: string;
  currency: string;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  currentPrice: number | null;
  quantity: number;
  fees: number;
  setupType: string | null;
  tagsJson: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}): Trade {
  const logicalId = isAppUserId(record.profileId)
    ? fromScopedId(record.profileId, record.id)
    : record.id;

  return normalizeTrade({
    id: logicalId,
    ticker: record.ticker,
    name: record.name ?? undefined,
    pricingMode:
      record.pricingMode === "binance" ? "binance" : "manual",
    binanceMarketType:
      record.binanceMarketType === "spot" ||
      record.binanceMarketType === "usdm-futures"
        ? record.binanceMarketType
        : undefined,
    binanceSymbol: record.binanceSymbol ?? undefined,
    direction: record.direction as Trade["direction"],
    status: record.status as Trade["status"],
    assetClass: record.assetClass as Trade["assetClass"],
    currency: record.currency as Trade["currency"],
    entryDate: record.entryDate,
    exitDate: record.exitDate ?? undefined,
    entryPrice: record.entryPrice,
    exitPrice: record.exitPrice ?? undefined,
    currentPrice: record.currentPrice ?? undefined,
    quantity: record.quantity,
    fees: record.fees,
    setupType: record.setupType ?? undefined,
    tags: deserializeTags(record.tagsJson),
    notes: record.notes ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toThought(record: {
  id: string;
  profileId: string;
  title: string;
  content: string;
  category: string;
  tagsJson: string;
  ticker: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}): Thought {
  const logicalId = isAppUserId(record.profileId)
    ? fromScopedId(record.profileId, record.id)
    : record.id;

  return {
    id: logicalId,
    title: record.title,
    content: record.content,
    category: record.category as Thought["category"],
    tags: deserializeTags(record.tagsJson),
    ticker: record.ticker ?? undefined,
    isPrivate: record.isPrivate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function getServerSnapshot(): Promise<ServerSnapshot> {
  await ensureServerSetup();

  const [profiles, trades, thoughts, settings] = await Promise.all([
    db.profile.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    db.tradeRecord.findMany({
      orderBy: [{ profileId: "asc" }, { updatedAt: "desc" }],
    }),
    db.thoughtRecord.findMany({
      orderBy: [{ profileId: "asc" }, { updatedAt: "desc" }],
    }),
    db.portfolioSetting.findMany(),
  ]);

  const tradesByUser = buildEmptyTradesByUser();
  const thoughtsByUser = buildEmptyThoughtsByUser();
  const settingsByUser = buildDefaultSettingsByUser();

  trades.forEach((record) => {
    if (isAppUserId(record.profileId)) {
      tradesByUser[record.profileId].push(toTrade(record));
    }
  });

  thoughts.forEach((record) => {
    if (isAppUserId(record.profileId)) {
      thoughtsByUser[record.profileId].push(toThought(record));
    }
  });

  settings.forEach((record) => {
    if (isAppUserId(record.profileId)) {
      settingsByUser[record.profileId] = {
        initialCapital: normalizeCapital(record.initialCapital),
      };
    }
  });

  const serverHasData =
    Object.values(tradesByUser).some((items) => items.length > 0) ||
    Object.values(thoughtsByUser).some((items) => items.length > 0) ||
    Object.values(settingsByUser).some(
      (setting) => normalizeCapital(setting.initialCapital) !== DEFAULT_INITIAL_CAPITAL
    );

  return {
    profiles: APP_USERS.map((user) => ({
      id: user.id,
      name: profiles.find((profile) => profile.id === user.id)?.name ?? user.name,
    })),
    tradesByUser,
    thoughtsByUser,
    settingsByUser,
    serverHasData,
    syncedAt: new Date().toISOString(),
  };
}

export async function upsertTrade(profileId: AppUserId, trade: Trade): Promise<Trade> {
  await ensureServerSetup();

  const normalizedTrade = normalizeTrade(trade);

  const scopedId = toScopedId(profileId, normalizedTrade.id);
  const existing = await db.tradeRecord.findFirst({
    where: {
      profileId,
      id: { in: [scopedId, normalizedTrade.id] },
    },
  });

  const payload = {
    id: scopedId,
    profileId,
    ticker: normalizedTrade.ticker,
    name: normalizedTrade.name ?? null,
    pricingMode: normalizedTrade.pricingMode,
    binanceMarketType: normalizedTrade.binanceMarketType ?? null,
    binanceSymbol: normalizedTrade.binanceSymbol ?? null,
    direction: normalizedTrade.direction,
    status: normalizedTrade.status,
    assetClass: normalizedTrade.assetClass,
    currency: normalizedTrade.currency,
    entryDate: normalizedTrade.entryDate,
    exitDate: normalizedTrade.exitDate ?? null,
    entryPrice: normalizedTrade.entryPrice,
    exitPrice: normalizedTrade.exitPrice ?? null,
    currentPrice: normalizedTrade.currentPrice ?? null,
    quantity: normalizedTrade.quantity,
    fees: normalizedTrade.fees,
    setupType: normalizedTrade.setupType ?? null,
    tagsJson: serializeTags(normalizedTrade.tags),
    notes: normalizedTrade.notes ?? null,
    createdAt: normalizedTrade.createdAt,
    updatedAt: normalizedTrade.updatedAt,
  };

  const record = existing
    ? await db.tradeRecord.update({
        where: { id: existing.id },
        data: payload,
      })
    : await db.tradeRecord.create({
        data: payload,
      });

  return toTrade(record);
}

export async function deleteTrade(profileId: AppUserId, tradeId: string) {
  await ensureServerSetup();

  await db.tradeRecord.deleteMany({
    where: {
      profileId,
      id: { in: [tradeId, toScopedId(profileId, tradeId)] },
    },
  });
}

export async function deleteTrades(profileId: AppUserId, tradeIds: string[]) {
  await ensureServerSetup();

  const ids = Array.from(
    new Set(
      tradeIds.flatMap((tradeId) => [tradeId, toScopedId(profileId, tradeId)])
    )
  );

  await db.tradeRecord.deleteMany({
    where: {
      profileId,
      id: { in: ids },
    },
  });
}

export async function upsertThought(profileId: AppUserId, thought: Thought): Promise<Thought> {
  await ensureServerSetup();

  const scopedId = toScopedId(profileId, thought.id);
  const existing = await db.thoughtRecord.findFirst({
    where: {
      profileId,
      id: { in: [scopedId, thought.id] },
    },
  });

  const payload = {
    id: scopedId,
    profileId,
    title: thought.title,
    content: thought.content,
    category: thought.category,
    tagsJson: serializeTags(thought.tags),
    ticker: thought.ticker ?? null,
    isPrivate: Boolean(thought.isPrivate),
    createdAt: thought.createdAt,
    updatedAt: thought.updatedAt,
  };

  const record = existing
    ? await db.thoughtRecord.update({
        where: { id: existing.id },
        data: payload,
      })
    : await db.thoughtRecord.create({
        data: payload,
      });

  return toThought(record);
}

export async function deleteThought(profileId: AppUserId, thoughtId: string) {
  await ensureServerSetup();

  await db.thoughtRecord.deleteMany({
    where: {
      profileId,
      id: { in: [thoughtId, toScopedId(profileId, thoughtId)] },
    },
  });
}

export async function updateInitialCapital(profileId: AppUserId, initialCapital: number) {
  await ensureServerSetup();

  const normalizedCapital = normalizeCapitalForWrite(initialCapital);

  const record = await db.portfolioSetting.upsert({
    where: { profileId },
    update: {
      initialCapital: normalizedCapital,
    },
    create: {
      profileId,
      initialCapital: normalizedCapital,
    },
  });

  return {
    initialCapital: normalizeCapital(record.initialCapital),
  };
}

export async function updateTradeCurrentPrices(
  profileId: AppUserId,
  updates: Array<{ id: string; currentPrice: number }>
) {
  await ensureServerSetup();

  const normalizedUpdates = updates.filter(
    (update) =>
      typeof update.id === "string" &&
      update.id.length > 0 &&
      Number.isFinite(update.currentPrice) &&
      update.currentPrice > 0
  );

  if (normalizedUpdates.length === 0) {
    return 0;
  }

  return db.$transaction(async (tx) => {
    const candidateIds = Array.from(
      new Set(
        normalizedUpdates.flatMap((update) => [
          update.id,
          toScopedId(profileId, update.id),
        ])
      )
    );

    const existingRecords = await tx.tradeRecord.findMany({
      where: {
        profileId,
        status: "open",
        id: { in: candidateIds },
      },
      select: {
        id: true,
      },
    });

    const recordIdByLogicalId = new Map<string, string>();
    existingRecords.forEach((record) => {
      recordIdByLogicalId.set(fromScopedId(profileId, record.id), record.id);
    });

    let updatedCount = 0;

    for (const update of normalizedUpdates) {
      const recordId = recordIdByLogicalId.get(update.id);
      if (!recordId) continue;

      await tx.tradeRecord.update({
        where: { id: recordId },
        data: {
          currentPrice: update.currentPrice,
        },
      });
      updatedCount += 1;
    }

    return updatedCount;
  });
}

async function replaceProfileTrades(profileId: AppUserId, trades: Trade[]) {
  await db.$transaction(async (tx) => {
    await tx.tradeRecord.deleteMany({ where: { profileId } });

    if (trades.length > 0) {
      await tx.tradeRecord.createMany({
        data: trades.map((trade) => {
          const normalizedTrade = normalizeTrade(trade);

          return {
            id: toScopedId(profileId, normalizedTrade.id),
            profileId,
            ticker: normalizedTrade.ticker,
            name: normalizedTrade.name ?? null,
            pricingMode: normalizedTrade.pricingMode,
            binanceMarketType: normalizedTrade.binanceMarketType ?? null,
            binanceSymbol: normalizedTrade.binanceSymbol ?? null,
            direction: normalizedTrade.direction,
            status: normalizedTrade.status,
            assetClass: normalizedTrade.assetClass,
            currency: normalizedTrade.currency,
            entryDate: normalizedTrade.entryDate,
            exitDate: normalizedTrade.exitDate ?? null,
            entryPrice: normalizedTrade.entryPrice,
            exitPrice: normalizedTrade.exitPrice ?? null,
            currentPrice: normalizedTrade.currentPrice ?? null,
            quantity: normalizedTrade.quantity,
            fees: normalizedTrade.fees,
            setupType: normalizedTrade.setupType ?? null,
            tagsJson: serializeTags(normalizedTrade.tags),
            notes: normalizedTrade.notes ?? null,
            createdAt: normalizedTrade.createdAt,
            updatedAt: normalizedTrade.updatedAt,
          };
        }),
      });
    }
  });
}

async function replaceProfileThoughts(profileId: AppUserId, thoughts: Thought[]) {
  await db.$transaction(async (tx) => {
    await tx.thoughtRecord.deleteMany({ where: { profileId } });

    if (thoughts.length > 0) {
      await tx.thoughtRecord.createMany({
        data: thoughts.map((thought) => ({
          id: toScopedId(profileId, thought.id),
          profileId,
          title: thought.title,
          content: thought.content,
          category: thought.category,
          tagsJson: serializeTags(thought.tags),
          ticker: thought.ticker ?? null,
          isPrivate: Boolean(thought.isPrivate),
          createdAt: thought.createdAt,
          updatedAt: thought.updatedAt,
        })),
      });
    }
  });
}

export async function importTradesForProfile(
  profileId: AppUserId,
  trades: Trade[],
  mode: "merge" | "overwrite"
) {
  await ensureServerSetup();

  if (mode === "overwrite") {
    await replaceProfileTrades(profileId, trades);
    return;
  }

  const existing = await db.tradeRecord.findMany({ where: { profileId } });
  const merged = mergeById(existing.map(toTrade), trades);
  await replaceProfileTrades(profileId, merged);
}

export async function importThoughtsForProfile(
  profileId: AppUserId,
  thoughts: Thought[],
  mode: "merge" | "overwrite"
) {
  await ensureServerSetup();

  if (mode === "overwrite") {
    await replaceProfileThoughts(profileId, thoughts);
    return;
  }

  const existing = await db.thoughtRecord.findMany({ where: { profileId } });
  const merged = mergeById(existing.map(toThought), thoughts);
  await replaceProfileThoughts(profileId, merged);
}

export async function importBackup(
  payload: {
    tradesByUser: TradesByUser;
    thoughtsByUser: ThoughtsByUser;
    settingsByUser: SettingsByUser;
  },
  mode: "merge" | "overwrite"
) {
  await ensureServerSetup();

  for (const user of APP_USERS) {
    await importTradesForProfile(user.id, payload.tradesByUser[user.id] ?? [], mode);
    await importThoughtsForProfile(user.id, payload.thoughtsByUser[user.id] ?? [], mode);

    if (mode === "overwrite") {
      await updateInitialCapital(
        user.id,
        payload.settingsByUser[user.id]?.initialCapital ?? DEFAULT_INITIAL_CAPITAL
      );
    }
  }
}

export async function createServerBackup(): Promise<ServerBackupPayload> {
  const snapshot = await getServerSnapshot();

  return {
    version: 1,
    type: "multi-user-backup",
    exportedAt: new Date().toISOString(),
    ...snapshot,
  };
}
