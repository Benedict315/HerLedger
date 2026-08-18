import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Singleton Prisma client for the indexer process.
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}