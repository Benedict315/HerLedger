import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";
import { businessRoutes } from "./businesses.js";
import { supportedAssetsRoutes } from "./supported-assets.js";
import { indexerStatusRoutes } from "./indexer-status.js";
import { transactionRoutes } from "./transactions.js";

export function registerRoutes(app: FastifyInstance): void {
  void app.register(healthRoutes, { prefix: "/health" });
  void app.register(businessRoutes, { prefix: "/businesses" });
  void app.register(supportedAssetsRoutes, { prefix: "/supported-assets" });
  void app.register(indexerStatusRoutes, { prefix: "/indexer" });
  void app.register(transactionRoutes, { prefix: "/transactions" });
}
