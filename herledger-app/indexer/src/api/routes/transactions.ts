import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrismaClient } from "../../db/client.js";

const hashSchema = z.object({
  hash: z.string().length(64),
});

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { hash: string } }>("/:hash", async (req, reply) => {
    const params = hashSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({
        data: null,
        error: { code: "INVALID_PARAMS", message: "Invalid transaction hash" },
      });
    }

    const tx = await getPrismaClient().stellarTransaction.findUnique({
      where: { hash: params.data.hash },
    });

    if (!tx) {
      return reply.status(404).send({
        data: null,
        error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found" },
      });
    }

    return reply.send({ data: tx, error: null });
  });
}
