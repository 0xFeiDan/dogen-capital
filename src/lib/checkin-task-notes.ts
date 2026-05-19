import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { DailyCheckinTask } from "@/types";

type TaskRow = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  lastCheckedAt: string | null;
  todayCheckedAt: string | null;
  checkCount: number | bigint | string;
};

let setupPromise: Promise<void> | null = null;

export function getTodayInShanghai() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

export async function ensureCheckinTaskNoteSetup() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CheckinTaskItem" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "profileId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "createdAt" TEXT NOT NULL,
          "updatedAt" TEXT NOT NULL,
          "endedAt" TEXT,
          CONSTRAINT "CheckinTaskItem_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "Profile" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "CheckinTaskItem_profileId_status_idx"
          ON "CheckinTaskItem" ("profileId", "status")
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "CheckinTaskItem_profileId_updatedAt_idx"
          ON "CheckinTaskItem" ("profileId", "updatedAt")
      `);

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CheckinTaskDailyCheck" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "profileId" TEXT NOT NULL,
          "taskId" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "checkedAt" TEXT NOT NULL,
          CONSTRAINT "CheckinTaskDailyCheck_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "Profile" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CheckinTaskDailyCheck_taskId_fkey"
            FOREIGN KEY ("taskId") REFERENCES "CheckinTaskItem" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "CheckinTaskDailyCheck_taskId_date_key"
          ON "CheckinTaskDailyCheck" ("taskId", "date")
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "CheckinTaskDailyCheck_profileId_date_idx"
          ON "CheckinTaskDailyCheck" ("profileId", "date")
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "CheckinTaskDailyCheck_taskId_date_idx"
          ON "CheckinTaskDailyCheck" ("taskId", "date")
      `);
    })();
  }

  await setupPromise;
}

function toTask(row: TaskRow): DailyCheckinTask {
  const status = row.status === "ended" ? "ended" : "pending";

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    description: row.content,
    status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    endedAt: row.endedAt ?? undefined,
    checkedToday: Boolean(row.todayCheckedAt),
    todayCheckedAt: row.todayCheckedAt ?? undefined,
    lastCheckedAt: row.lastCheckedAt ?? undefined,
    checkCount: Number(row.checkCount),
  };
}

export async function listCheckinTaskNotes(
  profileId: string,
  date = getTodayInShanghai()
): Promise<DailyCheckinTask[]> {
  await ensureCheckinTaskNoteSetup();

  const rows = await db.$queryRaw<TaskRow[]>`
    SELECT
      task."id",
      task."title",
      task."content",
      task."status",
      task."createdAt",
      task."updatedAt",
      task."endedAt",
      MAX(checks."checkedAt") AS "lastCheckedAt",
      today."checkedAt" AS "todayCheckedAt",
      COUNT(checks."id") AS "checkCount"
    FROM "CheckinTaskItem" task
    LEFT JOIN "CheckinTaskDailyCheck" checks ON checks."taskId" = task."id"
    LEFT JOIN "CheckinTaskDailyCheck" today
      ON today."taskId" = task."id" AND today."date" = ${date}
    WHERE task."profileId" = ${profileId}
    GROUP BY task."id", today."checkedAt"
    ORDER BY
      CASE WHEN task."status" = 'ended' THEN 1 ELSE 0 END ASC,
      task."updatedAt" DESC
  `;

  return rows.map(toTask);
}

export async function upsertCheckinTaskNote(
  profileId: string,
  task: DailyCheckinTask
): Promise<DailyCheckinTask> {
  await ensureCheckinTaskNoteSetup();

  const now = new Date().toISOString();
  const id = task.id || randomUUID();
  const status = task.status === "ended" ? "ended" : "pending";
  const endedAt = status === "ended" ? task.endedAt ?? now : null;
  const content = task.content ?? task.description ?? "";

  const existing = await db.$queryRaw<Array<{ id: string; createdAt: string }>>`
    SELECT "id", "createdAt" FROM "CheckinTaskItem"
    WHERE "id" = ${id} AND "profileId" = ${profileId}
    LIMIT 1
  `;

  if (existing[0]) {
    await db.$executeRaw`
      UPDATE "CheckinTaskItem"
      SET "title" = ${task.title.trim()},
          "content" = ${content},
          "status" = ${status},
          "updatedAt" = ${now},
          "endedAt" = ${endedAt}
      WHERE "id" = ${id} AND "profileId" = ${profileId}
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "CheckinTaskItem"
        ("id", "profileId", "title", "content", "status", "createdAt", "updatedAt", "endedAt")
      VALUES
        (${id}, ${profileId}, ${task.title.trim()}, ${content}, ${status}, ${task.createdAt || now}, ${now}, ${endedAt})
    `;
  }

  const tasks = await listCheckinTaskNotes(profileId);
  return tasks.find((item) => item.id === id) ?? {
    ...task,
    id,
    content,
    description: content,
    status,
    updatedAt: now,
    endedAt: endedAt ?? undefined,
  };
}

export async function deleteCheckinTaskNote(profileId: string, taskId: string) {
  await ensureCheckinTaskNoteSetup();

  await db.$executeRaw`
    DELETE FROM "CheckinTaskItem"
    WHERE "id" = ${taskId} AND "profileId" = ${profileId}
  `;
}

export async function checkTaskToday(
  profileId: string,
  taskId: string,
  date = getTodayInShanghai()
) {
  await ensureCheckinTaskNoteSetup();

  const now = new Date().toISOString();
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CheckinTaskDailyCheck"
    WHERE "taskId" = ${taskId} AND "date" = ${date}
    LIMIT 1
  `;

  if (existing[0]) {
    await db.$executeRaw`
      UPDATE "CheckinTaskDailyCheck"
      SET "checkedAt" = ${now}
      WHERE "id" = ${existing[0].id}
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "CheckinTaskDailyCheck" ("id", "profileId", "taskId", "date", "checkedAt")
      VALUES (${randomUUID()}, ${profileId}, ${taskId}, ${date}, ${now})
    `;
  }

  const tasks = await listCheckinTaskNotes(profileId, date);
  return tasks.find((task) => task.id === taskId) ?? null;
}
