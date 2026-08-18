import type { PrismaClient } from "@prisma/client";
import { DatabaseError } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Dead-letter repository (indexer_errors table)
// ---------------------------------------------------------------------------

export interface DeadLetterInput {
  rawXdr: string;
  stage: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function writeDeadLetter(
  prisma: PrismaClient,
  input: DeadLetterInput
): Promise<{ errorId: string }> {
  try {
    const row = await prisma.indexerError.create({
      data: {
        rawXdr: input.rawXdr,
        stage: input.stage,
        message: input.message,
        context: input.context ?? undefined,
      },
      select: { errorId: true },
    });
    return row;
  } catch (cause) {
    throw new DatabaseError("Failed to write dead-letter row", cause);
  }
}

export async function findDeadLetterByErrorId(
  prisma: PrismaClient,
  errorId: string
) {
  try {
    return await prisma.indexerError.findUnique({ where: { errorId } });
  } catch (cause) {
    throw new DatabaseError(
      `Failed to find dead-letter row ${errorId}`,
      cause
    );
  }
}

export async function markDeadLetterResolved(
  prisma: PrismaClient,
  errorId: string
): Promise<void> {
  try {
    await prisma.indexerError.update({
      where: { errorId },
      data: { resolvedAt: new Date() },
    });
  } catch (cause) {
    throw new DatabaseError(
      `Failed to mark dead-letter row ${errorId} resolved`,
      cause
    );
  }
}

export async function incrementDeadLetterRetry(
  prisma: PrismaClient,
  errorId: string,
  message: string
): Promise<void> {
  try {
    await prisma.indexerError.update({
      where: { errorId },
      data: { retryCount: { increment: 1 }, message },
    });
  } catch (cause) {
    throw new DatabaseError(
      `Failed to increment retry count for ${errorId}`,
      cause
    );
  }
}