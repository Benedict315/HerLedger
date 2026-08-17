import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Singleton Prisma client for the indexer process.
// ---------------------------------------------------------------------------

const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;

/**
 * Builds the DATABASE_URL with a Postgres `statement_timeout` query param
 * attached, so a slow or locked query is killed after a fixed maximum
 * instead of holding a connection (and the pool slot behind it)
 * indefinitely. Override via DB_STATEMENT_TIMEOUT_MS if 10s is too tight
 * or too loose for a given deployment.
 */
function buildDatabaseUrl(): string {
  const raw = process.env["DATABASE_URL"];
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  const url = new URL(raw);
  if (!url.searchParams.has("statement_timeout")) {
    const timeoutMs = process.env["DB_STATEMENT_TIMEOUT_MS"]
      ? Number(process.env["DB_STATEMENT_TIMEOUT_MS"])
      : DEFAULT_STATEMENT_TIMEOUT_MS;
    url.searchParams.set("statement_timeout", String(timeoutMs));
  }
  return url.toString();
}

let _prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    const isDev = process.env["NODE_ENV"] === "development";

    _prisma = new PrismaClient({
      datasourceUrl: buildDatabaseUrl(),
      log: [
        ...(isDev ? [{ emit: "event", level: "query" } as const] : []),
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
    });

    _prisma.$on("warn", (e: { message: string }) => {
      console.warn({ event: "prisma-warn", message: e.message });
    });

    // A statement_timeout hit surfaces as a Postgres error on the query.
    // Log it distinctly so timed-out queries are easy to find/alert on,
    // including the elapsed time Prisma reports for the failed query.
    _prisma.$on("error", (e: { message: string; target?: unknown }) => {
      const isTimeout = /statement timeout|canceling statement/i.test(e.message);
      console.error({
        event: isTimeout ? "prisma-query-timeout" : "prisma-error",
        message: e.message,
        target: e.target,
      });
    });

    if (isDev) {
      _prisma.$on("query", (e: { query: string; duration: number }) => {
        console.log({
          event: "prisma-query",
          query: e.query,
          durationMs: e.duration,
        });
      });
    }
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}