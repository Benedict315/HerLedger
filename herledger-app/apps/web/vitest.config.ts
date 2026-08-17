import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["**/*.type-test.ts"],
      tsconfig: "./tsconfig.typecheck.json",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
