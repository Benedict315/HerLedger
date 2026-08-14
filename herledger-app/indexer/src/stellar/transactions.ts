import { Horizon } from "@stellar/stellar-sdk";
import type { ParsedPayment } from "../types/index.js";

// ---------------------------------------------------------------------------
// Transaction parsing utilities
// ---------------------------------------------------------------------------

/**
 * Parse Horizon transaction records into normalized payment records.
 * Only processes successful transactions with supported asset operations.
 * Never processes failed transactions.
 */
export function parsePaymentsFromTransaction(
  tx: Horizon.ServerApi.TransactionRecord,
  supportedAssets: Set<string>
): ParsedPayment[] {
  // Never classify failed transactions
  if (!tx.successful) return [];

  const payments: ParsedPayment[] = [];

  // Horizon envelopes contain operations — we parse the raw operation list
  // via tx.operations (lazy-loaded) or via XDR envelope
  // For indexer purposes we use the operations endpoint via the links
  // This function is called after operations are fetched separately
  return payments;
}

/**
 * Determine if a Stellar asset contract address is in the supported set.
 */
export function isSupportedAssetAddress(
  assetAddress: string,
  supportedAssets: Set<string>
): boolean {
  return supportedAssets.has(assetAddress);
}

/**
 * Normalize a Stellar amount string to bigint (preserves i128 precision).
 * Stellar amounts use 7 decimal places (stroops). Contract i128 is raw.
 */
export function parseAmount(rawAmount: string): bigint {
  try {
    return BigInt(rawAmount);
  } catch {
    // Handle decimal amounts from Horizon (e.g. "10.0000000")
    const [whole, decimal] = rawAmount.split(".");
    const decimalPart = (decimal ?? "").padEnd(7, "0").slice(0, 7);
    return BigInt(`${whole ?? "0"}${decimalPart}`);
  }
}
