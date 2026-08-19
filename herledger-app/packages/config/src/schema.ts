import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

const stellarContractId = z
  .string()
  .refine((val) => StrKey.isValidContract(val), {
    message: "Must be a valid Stellar contract address (56-char C... strkey)",
  });

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development").describe("Node environment"),
  APP_URL: z.string().url().describe("The canonical URL of the web application"),
  DATABASE_URL: z.string().min(1).describe("PostgreSQL connection string"),
  BETTER_AUTH_SECRET: z.string().min(32).describe("Secret key for auth session encryption"),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).describe("Stellar network selection"),
  STELLAR_RPC_URL: z.string().url().describe("Soroban RPC endpoint URL"),
  STELLAR_HORIZON_URL: z.string().url().describe("Horizon API endpoint URL"),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1).describe("Stellar network passphrase"),
  INDEXER_API_URL: z.string().url().describe("Internal URL for the indexer service"),
  BUSINESS_REGISTRY_CONTRACT_ID: stellarContractId.describe("Contract ID for the Business Registry"),
  FINANCIAL_LEDGER_CONTRACT_ID: stellarContractId.describe("Contract ID for the Financial Ledger"),
  ATTESTATION_REGISTRY_CONTRACT_ID: stellarContractId.describe("Contract ID for the Attestation Registry"),
});

type WithNextPublic<T> = { [K in keyof T as `NEXT_PUBLIC_${string & K}`]: T[K] };

const withNextPublic = <T extends z.ZodRawShape>(shape: T): WithNextPublic<T> => {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [`NEXT_PUBLIC_${key}`, schema])
  ) as WithNextPublic<T>;
};

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).describe("Stellar network selection for the browser"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url().describe("Soroban RPC endpoint URL for the browser"),
  NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: stellarContractId.describe("Contract ID for the Business Registry"),
  NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: stellarContractId.describe("Contract ID for the Financial Ledger"),
  NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: stellarContractId.describe("Contract ID for the Attestation Registry"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function formatZodError(error: z.ZodError) {
  const issues = error.issues.map((i) => {
    const path = i.path.join(".");
    let description = "No description available";
    
    const serverShape = serverEnvSchema.shape as Record<string, z.ZodTypeAny | undefined>;
    const publicShape = publicEnvSchema.shape as Record<string, z.ZodTypeAny | undefined>;
    const serverField = serverShape[path];
    const publicField = publicShape[path];
    
    if (serverField?.description) description = serverField.description;
    else if (publicField?.description) description = publicField.description;

    return {
      Variable: path,
      Error: i.message,
      Description: description,
    };
  });

  return issues;
}
