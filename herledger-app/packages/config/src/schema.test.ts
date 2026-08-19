import { describe, it, expect, vi } from "vitest";
import { serverEnvSchema, publicEnvSchema, formatZodError } from "./schema.js";

vi.mock("@stellar/stellar-sdk", () => {
  return {
    StrKey: {
      isValidContract: (val: string) => val.startsWith("C") && val.length === 56,
    },
  };
});

const VALID_SERVER_ENV = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "12345678901234567890123456789012",
  STELLAR_NETWORK: "testnet",
  STELLAR_RPC_URL: "http://localhost:8000",
  STELLAR_HORIZON_URL: "http://localhost:8000",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  BUSINESS_REGISTRY_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
  FINANCIAL_LEDGER_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
  ATTESTATION_REGISTRY_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
  INDEXER_API_URL: "http://localhost:8080",
};

describe("Environment Schema", () => {
  describe("serverEnvSchema", () => {
    it("should pass when all required vars are present", () => {
      const result = serverEnvSchema.safeParse(VALID_SERVER_ENV);
      expect(result.success).toBe(true);
    });

    it("should fail when all required vars are missing", () => {
      const result = serverEnvSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = formatZodError(result.error);
        expect(issues.length).toBeGreaterThan(5); // several required fields
        expect(issues.some((i) => i.Variable === "DATABASE_URL")).toBe(true);
      }
    });

    it("should fail when partially missing", () => {
      const partial: Record<string, string> = { ...VALID_SERVER_ENV };
      delete partial["APP_URL"];
      const result = serverEnvSchema.safeParse(partial);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = formatZodError(result.error);
        expect(issues.length).toBe(1);
        expect(issues[0]?.Variable).toBe("APP_URL");
      }
    });
  });

  describe("publicEnvSchema", () => {
    const VALID_PUBLIC_ENV = {
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "http://localhost:8000",
      NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
      NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
      NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: "CA7JDAO9SGZ8EZEQHTJEXNXB7N6Q9O7N8Y9O7N8Y9O7N8Y9O7N8Y9O7N",
    };

    it("should pass when all required vars are present", () => {
      const result = publicEnvSchema.safeParse(VALID_PUBLIC_ENV);
      expect(result.success).toBe(true);
    });

    it("should fail when contract ID is missing", () => {
      const partial: Record<string, string> = { ...VALID_PUBLIC_ENV };
      delete partial["NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID"];
      const result = publicEnvSchema.safeParse(partial);
      expect(result.success).toBe(false);
    });
  });
});
