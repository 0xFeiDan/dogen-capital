import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dogen.db";
}

declare global {
  // eslint-disable-next-line no-var
  var __dogenPrisma__: PrismaClient | undefined;
}

export const db =
  global.__dogenPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__dogenPrisma__ = db;
}
