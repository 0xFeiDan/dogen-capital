import type { DcaEntry, DcaSyncSetting, Thought, Trade } from "@/types";
import { db } from "@/lib/db";
import { getDcaEntrySide } from "@/lib/dca";
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
    CREATE TABLE IF NOT EXISTS "DcaRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "ticker" TEXT NOT NULL,
      "name" TEXT,
      "side" TEXT,
      "assetClass" TEXT NOT NULL,
      "currency" TEXT NOT NULL,
      "investedAt" TEXT NOT NULL,
      "investedAmount" REAL NOT NULL,
      "quantity" REAL NOT NULL,
      "currentPrice" REAL,
      "quoteSymbol" TEXT,
      "quoteCurrency" TEXT,
      "priceUpdatedAt" TEXT,
      "source" TEXT,
      "sourceAddress" TEXT,
      "externalId" TEXT,
      "sourceUpdatedAt" TEXT,
      "notes" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT "DcaRecord_profileId_fkey"
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
    CREATE TABLE IF NOT EXISTS "DcaSyncSetting" (
      "profileId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "lastSyncedAt" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("profileId", "provider"),
      CONSTRAINT "DcaSyncSetting_profileId_fkey"
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

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DcaRecord_profileId_assetClass_idx"
    ON "DcaRecord" ("profileId", "assetClass")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DcaRecord_profileId_updatedAt_idx"
    ON "DcaRecord" ("profileId", "updatedAt")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DcaRecord_profileId_source_sourceAddress_idx"
    ON "DcaRecord" ("profileId", "source", "sourceAddress")
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

  const dcaColumns = await db.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("DcaRecord")`
  );
  const dcaColumnNames = new Set(dcaColumns.map((column) => column.name));

  if (!dcaColumnNames.has("currentPrice")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "currentPrice" REAL`
    );
  }

  if (!dcaColumnNames.has("side")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "side" TEXT`
    );
  }

  if (!dcaColumnNames.has("quoteSymbol")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "quoteSymbol" TEXT`
    );
  }

  if (!dcaColumnNames.has("quoteCurrency")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "quoteCurrency" TEXT`
    );
  }

  if (!dcaColumnNames.has("priceUpdatedAt")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "priceUpdatedAt" TEXT`
    );
  }

  if (!dcaColumnNames.has("source")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "source" TEXT`
    );
  }

  if (!dcaColumnNames.has("sourceAddress")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "sourceAddress" TEXT`
    );
  }

  if (!dcaColumnNames.has("externalId")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "externalId" TEXT`
    );
  }

  if (!dcaColumnNames.has("sourceUpdatedAt")) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DcaRecord" ADD COLUMN "sourceUpdatedAt" TEXT`
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
export type DcaByUser = Record<AppUserId, DcaEntry[]>;
export type SettingsByUser = Record<AppUserId, { initialCapital: number }>;
export type DcaSyncProvider = DcaSyncSetting["provider"];

export interface ServerSnapshot {
  profiles: AppUserProfile[];
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  dcaByUser: DcaByUser;
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

function buildEmptyDcaByUser(): DcaByUser {
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

function toDcaSyncSetting(record: {
  provider: string;
  address: string;
  lastSyncedAt: string | null;
}): DcaSyncSetting {
  return {
    provider: record.provider === "hyperliquid" ? "hyperliquid" : "hyperliquid",
    address: record.address,
    lastSyncedAt: record.lastSyncedAt ?? undefined,
  };
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

function toDcaEntry(record: {
  id: string;
  profileId: string;
  ticker: string;
  name: string | null;
  side: string | null;
  assetClass: string;
  currency: string;
  investedAt: string;
  investedAmount: number;
  quantity: number;
  currentPrice: number | null;
  quoteSymbol: string | null;
  quoteCurrency: string | null;
  priceUpdatedAt: string | null;
  source: string | null;
  sourceAddress: string | null;
  externalId: string | null;
  sourceUpdatedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}): DcaEntry {
  const logicalId = isAppUserId(record.profileId)
    ? fromScopedId(record.profileId, record.id)
    : record.id;

  return {
    id: logicalId,
    ticker: record.ticker,
    name: record.name ?? undefined,
    side: record.side === "sell" ? "sell" : "buy",
    assetClass: record.assetClass as DcaEntry["assetClass"],
    currency: record.currency as DcaEntry["currency"],
    investedAt: record.investedAt,
    investedAmount: record.investedAmount,
    quantity: record.quantity,
    currentPrice: record.currentPrice ?? undefined,
    quoteSymbol: record.quoteSymbol ?? undefined,
    quoteCurrency: record.quoteCurrency
      ? (record.quoteCurrency as DcaEntry["quoteCurrency"])
      : undefined,
    priceUpdatedAt: record.priceUpdatedAt ?? undefined,
    source: record.source === "hyperliquid" ? "hyperliquid" : undefined,
    sourceAddress: record.sourceAddress ?? undefined,
    externalId: record.externalId ?? undefined,
    sourceUpdatedAt: record.sourceUpdatedAt ?? undefined,
    notes: record.notes ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toDcaRecordData(profileId: AppUserId, entry: DcaEntry) {
  return {
    id: toScopedId(profileId, entry.id),
    profileId,
    ticker: entry.ticker,
    name: entry.name ?? null,
    side: getDcaEntrySide(entry),
    assetClass: entry.assetClass,
    currency: entry.currency,
    investedAt: entry.investedAt,
    investedAmount: entry.investedAmount,
    quantity: entry.quantity,
    currentPrice: entry.currentPrice ?? null,
    quoteSymbol: entry.quoteSymbol ?? null,
    quoteCurrency: entry.quoteCurrency ?? null,
    priceUpdatedAt: entry.priceUpdatedAt ?? null,
    source: entry.source ?? null,
    sourceAddress: entry.sourceAddress ?? null,
    externalId: entry.externalId ?? null,
    sourceUpdatedAt: entry.sourceUpdatedAt ?? null,
    notes: entry.notes ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function getServerSnapshot(): Promise<ServerSnapshot> {
  await ensureServerSetup();

  const [profiles, trades, thoughts, dcaEntries, settings] = await Promise.all([
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
    db.dcaRecord.findMany({
      orderBy: [{ profileId: "asc" }, { updatedAt: "desc" }],
    }),
    db.portfolioSetting.findMany(),
  ]);

  const tradesByUser = buildEmptyTradesByUser();
  const thoughtsByUser = buildEmptyThoughtsByUser();
  const dcaByUser = buildEmptyDcaByUser();
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

  dcaEntries.forEach((record) => {
    if (isAppUserId(record.profileId)) {
      dcaByUser[record.profileId].push(toDcaEntry(record));
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
    Object.values(dcaByUser).some((items) => items.length > 0) ||
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
    dcaByUser,
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

export async function upsertDcaEntry(
  profileId: AppUserId,
  entry: DcaEntry
): Promise<DcaEntry> {
  await ensureServerSetup();

  const scopedId = toScopedId(profileId, entry.id);
  const existing = await db.dcaRecord.findFirst({
    where: {
      profileId,
      id: { in: [scopedId, entry.id] },
    },
  });

  const payload = {
    ...toDcaRecordData(profileId, entry),
    id: scopedId,
  };

  const record = existing
    ? await db.dcaRecord.update({
        where: { id: existing.id },
        data: payload,
      })
    : await db.dcaRecord.create({
        data: payload,
      });

  return toDcaEntry(record);
}

export async function deleteDcaEntry(profileId: AppUserId, entryId: string) {
  await ensureServerSetup();

  await db.dcaRecord.deleteMany({
    where: {
      profileId,
      id: { in: [entryId, toScopedId(profileId, entryId)] },
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

export async function updateDcaCurrentPrices(
  profileId: AppUserId,
  updates: Array<{
    id: string;
    currentPrice: number;
    quoteSymbol?: string;
    quoteCurrency?: string;
    priceUpdatedAt?: string;
  }>
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

    const existingRecords = await tx.dcaRecord.findMany({
      where: {
        profileId,
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

      await tx.dcaRecord.update({
        where: { id: recordId },
        data: {
          currentPrice: update.currentPrice,
          quoteSymbol: update.quoteSymbol ?? null,
          quoteCurrency: update.quoteCurrency ?? null,
          priceUpdatedAt: update.priceUpdatedAt ?? new Date().toISOString(),
        },
      });
      updatedCount += 1;
    }

    return updatedCount;
  });
}

export async function getDcaEntriesForProfile(profileId: AppUserId): Promise<DcaEntry[]> {
  await ensureServerSetup();

  const entries = await db.dcaRecord.findMany({
    where: { profileId },
    orderBy: [{ updatedAt: "desc" }],
  });

  return entries.map(toDcaEntry);
}

export async function getDcaSyncSetting(
  profileId: AppUserId,
  provider: DcaSyncProvider = "hyperliquid"
): Promise<DcaSyncSetting | null> {
  await ensureServerSetup();

  const setting = await db.dcaSyncSetting.findUnique({
    where: {
      profileId_provider: {
        profileId,
        provider,
      },
    },
  });

  return setting ? toDcaSyncSetting(setting) : null;
}

export async function replaceAutoDcaEntriesForAddress(params: {
  profileId: AppUserId;
  provider?: DcaSyncProvider;
  address: string;
  previousAddressToRemove?: string;
  entries: DcaEntry[];
}): Promise<{
  entries: DcaEntry[];
  setting: DcaSyncSetting;
  importedCount: number;
  deletedCount: number;
}> {
  await ensureServerSetup();

  const provider = params.provider ?? "hyperliquid";
  const sourceAddress = params.address.toLowerCase();
  const previousAddressToRemove = params.previousAddressToRemove?.toLowerCase();
  const deleteAddresses = Array.from(
    new Set(
      [sourceAddress, previousAddressToRemove].filter(
        (address): address is string => Boolean(address)
      )
    )
  );
  const now = new Date().toISOString();
  const uniqueEntries = Array.from(
    new Map(params.entries.map((entry) => [entry.id, entry] as const)).values()
  );

  return db.$transaction(async (tx) => {
    if (uniqueEntries.length === 0) {
      const existingAutoEntriesToDelete = await tx.dcaRecord.count({
        where: {
          profileId: params.profileId,
          source: provider,
          sourceAddress: { in: deleteAddresses },
        },
      });

      if (existingAutoEntriesToDelete > 0) {
        throw new Error(
          "Hyperliquid returned 0 DCA entries; kept existing automatic records to avoid accidental deletion"
        );
      }
    }

    const deleted = await tx.dcaRecord.deleteMany({
      where: {
        profileId: params.profileId,
        source: provider,
        sourceAddress: { in: deleteAddresses },
      },
    });

    if (uniqueEntries.length > 0) {
      await tx.dcaRecord.createMany({
        data: uniqueEntries.map((entry) =>
          toDcaRecordData(params.profileId, {
            ...entry,
            source: provider,
            sourceAddress,
            sourceUpdatedAt: entry.sourceUpdatedAt ?? now,
          })
        ),
      });
    }

    const settingRecord = await tx.dcaSyncSetting.upsert({
      where: {
        profileId_provider: {
          profileId: params.profileId,
          provider,
        },
      },
      update: {
        address: sourceAddress,
        lastSyncedAt: now,
      },
      create: {
        profileId: params.profileId,
        provider,
        address: sourceAddress,
        lastSyncedAt: now,
      },
    });

    const allEntries = await tx.dcaRecord.findMany({
      where: { profileId: params.profileId },
      orderBy: [{ updatedAt: "desc" }],
    });

    return {
      entries: allEntries.map(toDcaEntry),
      setting: toDcaSyncSetting(settingRecord),
      importedCount: uniqueEntries.length,
      deletedCount: deleted.count,
    };
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

async function replaceProfileDcaEntries(profileId: AppUserId, entries: DcaEntry[]) {
  await db.$transaction(async (tx) => {
    await tx.dcaRecord.deleteMany({ where: { profileId } });

    if (entries.length > 0) {
      await tx.dcaRecord.createMany({
        data: entries.map((entry) => toDcaRecordData(profileId, entry)),
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

export async function importDcaEntriesForProfile(
  profileId: AppUserId,
  entries: DcaEntry[],
  mode: "merge" | "overwrite"
) {
  await ensureServerSetup();

  if (mode === "overwrite") {
    await replaceProfileDcaEntries(profileId, entries);
    return;
  }

  const existing = await db.dcaRecord.findMany({ where: { profileId } });
  const merged = mergeById(existing.map(toDcaEntry), entries);
  await replaceProfileDcaEntries(profileId, merged);
}

export async function importBackup(
  payload: {
    tradesByUser: TradesByUser;
    thoughtsByUser: ThoughtsByUser;
    dcaByUser: DcaByUser;
    settingsByUser: SettingsByUser;
  },
  mode: "merge" | "overwrite"
) {
  await ensureServerSetup();

  for (const user of APP_USERS) {
    await importTradesForProfile(user.id, payload.tradesByUser[user.id] ?? [], mode);
    await importThoughtsForProfile(user.id, payload.thoughtsByUser[user.id] ?? [], mode);
    await importDcaEntriesForProfile(user.id, payload.dcaByUser[user.id] ?? [], mode);

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
