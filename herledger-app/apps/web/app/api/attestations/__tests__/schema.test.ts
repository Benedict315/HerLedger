import { describe, it, expect } from "vitest";
import { attestationsQuerySchema } from "../schema";

describe("attestationsQuerySchema", () => {
  it("defaults includeRevoked to false when the param is absent", () => {
    const result = attestationsQuerySchema.parse({ includeRevoked: undefined });
    expect(result.includeRevoked).toBe(false);
  });

  it("parses includeRevoked=true to a boolean true", () => {
    const result = attestationsQuerySchema.parse({ includeRevoked: "true" });
    expect(result.includeRevoked).toBe(true);
  });

  it("parses includeRevoked=false to a boolean false", () => {
    const result = attestationsQuerySchema.parse({ includeRevoked: "false" });
    expect(result.includeRevoked).toBe(false);
  });

  it("rejects an arbitrary non-boolean-like value", () => {
    const result = attestationsQuerySchema.safeParse({ includeRevoked: "yes" });
    expect(result.success).toBe(false);
  });
});
