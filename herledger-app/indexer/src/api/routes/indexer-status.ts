import type { FastifyInstance } from "fastify";
import { getPrismaClient } from "../../db/client.js";
import { getCheckpoint, MAIN_STREAM } from "../../db/schema/checkpoint.js";
import { getCycleMetrics } from "../../jobs/sync-metrics.js";

export async function indexerStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get("/status", async (_req, reply) => {
    const lastLedger = await getCheckpoint(getPrismaClient(), MAIN_STREAM);
    return reply.send({
      data: { stream: MAIN_STREAM, lastLedger, lastCycle: getCycleMetrics() },
      error: null,
    });
  });
}
