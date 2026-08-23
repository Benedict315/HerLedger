import { logger } from "../observability/index.js";
import { IndexerError } from "../types/index.js";

// ---------------------------------------------------------------------------
// Exponential back-off retry helper for RPC calls
// ---------------------------------------------------------------------------

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  jitterFactor: 0.1,
};

/**
 * Retry a function with exponential backoff and jitter.
 * Attempts: 1s, 4s, 16s by default (configurable).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Check if error is permanent (should not retry)
      if (isPermanentError(err)) {
        throw new IndexerError(
          `Permanent error in ${operationName} (attempt ${attempt}/${cfg.maxAttempts})`,
          err
        );
      }

      if (attempt === cfg.maxAttempts) {
        throw new IndexerError(
          `${operationName} failed after ${cfg.maxAttempts} attempts`,
          lastError
        );
      }

      const delayMs = calculateBackoffDelay(attempt, cfg);
      logger.warn(
        {
          operation: operationName,
          attempt,
          maxAttempts: cfg.maxAttempts,
          delayMs,
          error: err instanceof Error ? err.message : String(err),
        },
        `Transient error in ${operationName}, retrying in ${delayMs}ms`
      );

      await sleep(delayMs);
    }
  }

  // Should never reach here due to throw in final attempt
  throw new IndexerError(
    `${operationName} failed after ${cfg.maxAttempts} attempts`,
    lastError
  );
}

/**
 * Calculate exponential backoff with jitter.
 * Prevents thundering herd when multiple callers retry simultaneously.
 */
function calculateBackoffDelay(attempt: number, cfg: Required<RetryConfig>): number {
  // Exponential: 2^(attempt-1) * baseDelayMs
  const exponentialDelay = Math.pow(2, attempt - 1) * cfg.baseDelayMs;
  const cappedDelay = Math.min(exponentialDelay, cfg.maxDelayMs);

  // Add jitter: ±jitterFactor% of the capped delay
  const jitterRange = cappedDelay * cfg.jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Determine if an error is permanent (should not retry) or transient (should retry).
 * Permanent: client errors (4xx), schema/XDR parsing errors, contract decode errors.
 * Transient: network errors, timeouts, server errors (5xx), rate limits (429).
 */
function isPermanentError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const message = err.message.toLowerCase();

  // Permanent errors
  if (message.includes("400") || message.includes("bad request")) return true;
  if (message.includes("401") || message.includes("unauthorized")) return true;
  if (message.includes("403") || message.includes("forbidden")) return true;
  if (message.includes("404") || message.includes("not found")) return true;

  // XDR/contract decode errors are permanent
  if (message.includes("xdr") || message.includes("decode")) return true;
  if (message.includes("invalid contract")) return true;
  if (message.includes("malformed")) return true;

  // Transient errors that should retry
  if (message.includes("econnrefused")) return false;
  if (message.includes("enotfound")) return false;
  if (message.includes("timeout")) return false;
  if (message.includes("500") || message.includes("server error")) return false;
  if (message.includes("502") || message.includes("bad gateway")) return false;
  if (message.includes("503") || message.includes("service unavailable")) return false;
  if (message.includes("429") || message.includes("too many requests")) return false;
  if (message.includes("rate")) return false;

  // Default: treat as transient
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
