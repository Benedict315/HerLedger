import type { FastifyInstance } from "fastify";
import { getPrismaClient } from "../../db/client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_req, reply) => {
    try {
      await getPrismaClient().$queryRaw`SELECT 1`;
      return reply.send({ data: { status: "ok", database: "connected" }, error: null });
    } catch {
      return reply.status(503).send({
        data: null,
        error: { code: "DB_UNAVAILABLE", message: "Database connection failed" },
      });
    }
  });
}
