// ---------------------------------------------------------------------------
// Formatting utilities — amount formatting at the presentation boundary.
// Never use JavaScript Number for large Stellar amounts.
// ---------------------------------------------------------------------------

/**
 * Format a bigint amount for display.
 * Stellar contract amounts are raw i128 values (7 decimal places for stroops).
 * Returns a string like "10.0000000 XLM" — asset symbol must be provided separately.
 */
export function formatAmount(amount: bigint, decimals = 7): string {
  if (decimals === 0) return amount.toString();

  const factor = BigInt(10 ** decimals);
  const whole = amount / factor;
  const fractional = amount % factor;

  const fractionalStr = fractional.toString().padStart(decimals, "0");
  return `${whole}.${fractionalStr}`;
}

/**
 * Truncate a Stellar address or hex ID for display.
 */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/**
 * Format a ledger sequence as a human-readable string.
 */
export function formatLedger(sequence: number): string {
  return `Ledger ${sequence.toLocaleString()}`;
}
