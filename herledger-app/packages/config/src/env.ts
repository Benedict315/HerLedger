import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

const stellarContractId = z
  .string()
  .refine((val) => StrKey.isValidContract(val), {
    message: "Must be a valid Stellar contract address (56-char C... strkey)",
  });

// ---------------------------------------------------------------------------
// Server-side environment schema (never exposed to browser)
// ---------------------------------------------------------------------------
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  BUSINESS_REGISTRY_CONTRACT_ID: stellarContractId,
  FINANCIAL_LEDGER_CONTRACT_ID: stellarContractId,
  ATTESTATION_REGISTRY_CONTRACT_ID: stellarContractId,
  INDEXER_API_URL: z.string().url(),
});

// ---------------------------------------------------------------------------
// Browser-safe environment schema (NEXT_PUBLIC_* only)
// ---------------------------------------------------------------------------
const publicEnvSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet"]),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url(),
  NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: stellarContractId,
  NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: stellarContractId,
  NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: stellarContractId,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Validate and return server-side environment variables.
 * Throws with a descriptive message on missing/invalid values.
 * Must only be called in server-side code.
 */
export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[HerLedger] Missing or invalid server environment variables:\n${issues}\n\nSee .env.example for required configuration.`
    );
  }
  return result.data;
}

/**
 * Validate and return browser-safe environment variables.
 * Safe to call in both client and server code.
 */
export function getPublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[HerLedger] Missing or invalid public environment variables:\n${issues}\n\nSee .env.example for required configuration.`
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Stellar network + contract config (moved from indexer/src/config/index.ts)
// ---------------------------------------------------------------------------
export interface StellarNetworkConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
}

export interface ContractConfig {
  businessRegistryId: string;
  financialLedgerId: string;
  attestationRegistryId: string;
}

export function getStellarNetworkConfig(): StellarNetworkConfig {
  const env = getServerEnv();
  return {
    network: env.STELLAR_NETWORK,
    rpcUrl: env.STELLAR_RPC_URL,
    horizonUrl: env.STELLAR_HORIZON_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  };
}

export function getContractConfig(): ContractConfig {
  const env = getServerEnv();
  return {
    businessRegistryId: env.BUSINESS_REGISTRY_CONTRACT_ID,
    financialLedgerId: env.FINANCIAL_LEDGER_CONTRACT_ID,
    attestationRegistryId: env.ATTESTATION_REGISTRY_CONTRACT_ID,
  };
}

// ---------------------------------------------------------------------------
// Network consistency validation
// ---------------------------------------------------------------------------
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * Asserts that network, RPC URL, and passphrase all agree with each other.
 * Throws a descriptive error on mismatch (e.g. testnet RPC + mainnet passphrase).
 * Call this once at startup in both the Next.js app and the indexer.
 */
export function validateNetworkConsistency(
  network: "testnet" | "mainnet",
  rpcUrl: string,
  passphrase: string
): void {
  const expectedPassphrase =
    network === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

  if (passphrase !== expectedPassphrase) {
    throw new Error(
      `[HerLedger] Network consistency check failed: STELLAR_NETWORK is "${network}" but STELLAR_NETWORK_PASSPHRASE does not match the expected ${network} passphrase. Expected: "${expectedPassphrase}", got: "${passphrase}".`
    );
  }

  const rpcLooksTestnet = /testnet/i.test(rpcUrl);
  const rpcLooksMainnet = /mainnet/i.test(rpcUrl);

  if (network === "mainnet" && rpcLooksTestnet) {
    throw new Error(
      `[HerLedger] Network consistency check failed: STELLAR_NETWORK is "mainnet" but STELLAR_RPC_URL ("${rpcUrl}") looks like a testnet URL.`
    );
  }

  if (network === "testnet" && rpcLooksMainnet) {
    throw new Error(
      `[HerLedger] Network consistency check failed: STELLAR_NETWORK is "testnet" but STELLAR_RPC_URL ("${rpcUrl}") looks like a mainnet URL.`
    );
  }
}