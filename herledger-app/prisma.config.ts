import { defineConfig, env } from "prisma/config";

// Prisma 7 CLI requires connection info to live in a config file rather than
// the `datasource.url` field in schema.prisma (which now errors with
// P1012). This file exists purely so `prisma migrate`/`generate`/etc. can
// resolve DATABASE_URL when run from this package -- it does not change
// how the generated `@prisma/client` package is instantiated at runtime.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
