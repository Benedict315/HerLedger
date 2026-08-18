import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Singleton Prisma client for the Next.js server runtime.
//
// A module-level singleton (rather than each route handler constructing its
// own `new PrismaClient()`) avoids opening a fresh connection pool per
// request in dev's hot-reload cycle and per API route in production.
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    _prisma = new PrismaClient({
      adapter: new PrismaPg(databaseUrl),
    });
  }
  return _prisma;
}
