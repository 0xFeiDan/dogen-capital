import { PrismaClient } from "@prisma/client";

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
