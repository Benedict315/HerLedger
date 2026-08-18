import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";

// ---------------------------------------------------------------------------
// Indexer HTTP API server
// ---------------------------------------------------------------------------

export function buildServer() {
  const isProduction = process.env["NODE_ENV"] === "production";

  const app = Fastify({
    logger: {
      level: isProduction ? "warn" : "info",
      ...(!isProduction && { transport: { target: "pino-pretty" } }),
    },
  });

  // Global error handler — never expose stack traces to clients
  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error, msg: "Unhandled request error" });
    void reply.status(500).send({
      data: null,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  registerRoutes(app);

  return app;
}
