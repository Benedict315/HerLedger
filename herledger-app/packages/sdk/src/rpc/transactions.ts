import {
  rpc as StellarRpc,
  Transaction,
  FeeBumpTransaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { StellarNetworkConfig, TransactionResult } from "../types/index.js";
import { RpcError, ContractError } from "../errors/index.js";
import { getSorobanRpcServer } from "./client.js";
import { signTransactionWithFreighter } from "../wallet/freighter.js";

// ---------------------------------------------------------------------------
// Transaction lifecycle helpers: simulate, prepare, submit, and poll.
//
// The submission path implements the reliability guidance from the Stellar
// docs (https://developers.stellar.org/docs/build/guides/basics/submit-transaction):
//   - `TRY_AGAIN_LATER` is retried with exponential back-off instead of being
//     surfaced as a hard failure or polled at a fixed rate.
//   - a rejected `tx_insufficient_fee` transaction can be recovered via a
//     fee-bump envelope (`submitWithFeeBump`).
// ---------------------------------------------------------------------------

const BASE_BACKOFF_MS = 1_000; // 1s
const MAX_BACKOFF_MS = 8_000; // 8s cap on the exponential schedule
const DEFAULT_MAX_WAIT_MS = 60_000; // 60s default total wait budget
const DEFAULT_POLL_INTERVAL_MS = 2_000; // ~ one Stellar ledger close

/** Progress information delivered to `SubmitAndWaitOptions.onRetry`. */
export interface RetryInfo {
  /** 1-based retry counter (the first retry is attempt 1). */
  attempt: number;
  /** How long the caller will sleep before the next attempt, in ms. */
  delayMs: number;
  /** The RPC status that triggered the retry (e.g. `"TRY_AGAIN_LATER"`). */
  status: string;
}

/** Options that tune `submitAndWait` / `submitWithFeeBump` without changing their required signature. */
export interface SubmitAndWaitOptions {
  /**
   * Total wall-clock budget for submission + confirmation, in milliseconds.
   * Defaults to 60_000 (60s).
   */
  maxWaitMs?: number;
  /**
   * Interval between confirmation polls once the transaction is accepted.
   * Defaults to 2_000 (2s), roughly one Stellar ledger close.
   */
  pollIntervalMs?: number;
  /**
   * Invoked on every `TRY_AGAIN_LATER` retry so callers can surface progress
   * (e.g. "network busy, retrying…").
   */
  onRetry?: (info: RetryInfo) => void;
  /**
   * When provided and aborted, in-flight sleeps reject and polling stops with
   * an `RpcError` whose `code` is `"ABORTED"`.
   */
  signal?: AbortSignal;
}

/**
 * Simulate a transaction and return the prepared transaction with the
 * resource footprint and fee populated from the simulation result.
 *
 * @param tx - The unsigned transaction to simulate.
 * @param config - Stellar network configuration.
 * @returns A `Transaction` assembled from the simulation result, ready to sign.
 * @throws {RpcError} with `code === "SIMULATION_FAILED"` when the RPC returns a
 *   simulation error result (e.g. a contract invocation failed, or contract
 *   state changed between simulation and submission). The error `cause` holds
 *   the simulation error detail.
 *
 * @example
 * ```ts
 * const prepared = await simulateAndPrepare(tx, config);
 * const signed = await signTransactionWithFreighter(prepared.toXDR(), config.networkPassphrase);
 * ```
 */
export async function simulateAndPrepare(
  tx: Transaction,
  config: StellarNetworkConfig
): Promise<Transaction> {
  const server = getSorobanRpcServer(config);
  let simResult: StellarRpc.Api.SimulateTransactionResponse;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (cause) {
    throw new RpcError("Transaction simulation failed", cause, "SIMULATION_FAILED");
  }

  // Validate the simulation result before preparing: a simulation that errored
  // (e.g. the contract rejected the call, or state changed since the last
  // ledger) must not be silently assembled and submitted as if it succeeded.
  if (StellarRpc.Api.isSimulationError(simResult)) {
    throw new RpcError(
      `Transaction simulation failed: ${simResult.error}`,
      simResult.error,
      "SIMULATION_FAILED"
    );
  }

  const prepared = StellarRpc.assembleTransaction(tx, simResult).build();
  return prepared as unknown as Transaction;
}

/**
 * Poll a submitted transaction hash until it confirms, fails, or the
 * polling budget is exhausted. Split out from `submitAndWait` so a caller
 * that persisted a hash before an earlier poll was interrupted (e.g. a
 * browser tab closed mid-`submitAndWait`) can resume polling that same
 * hash on its own, without resubmitting or re-signing the transaction.
 */
export async function pollTransactionStatus(
  hash: string,
  config: StellarNetworkConfig
): Promise<TransactionResult> {
  const server = getSorobanRpcServer(config);
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    let getResult: StellarRpc.Api.GetTransactionResponse;
    try {
      getResult = await server.getTransaction(hash);
    } catch (cause) {
      throw new RpcError(`Failed to poll transaction ${hash}`, cause, "POLL_FAILED");
    }

    if (getResult.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash, success: true, ledger: getResult.ledger };
    }
    if (getResult.status === StellarRpc.Api.GetTransactionStatus.FAILED) {
      throw new ContractError(`Transaction ${hash} failed on-chain`, getResult.status);
    }
    // NOT_FOUND (and any future congestion status) = still pending; keep polling
    // until the deadline. The deadline above guarantees termination.
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RpcError("Transaction submission was aborted", signal.reason, "ABORTED");
  }
}

/**
 * Submit a signed transaction XDR and poll until confirmed or failed.
 *
 * `onSubmitted`, when given, fires with the transaction hash right after
 * the network accepts the submission but before polling starts -- the
 * earliest point a caller can durably persist "this transaction is in
 * flight" (e.g. to localStorage) so a resumed session can pick up polling
 * via `pollTransactionStatus` instead of losing track of an on-chain
 * submission that outlived the page that made it.
 */
export async function submitAndWait(
  signedXdr: string,
  config: StellarNetworkConfig,
  onSubmitted?: (hash: string) => void
): Promise<TransactionResult> {
  const server = getSorobanRpcServer(config);

  // Parse the XDR back into a transaction object for submission
  const txObj = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);

  let sendResult: StellarRpc.Api.SendTransactionResponse;
  try {
    sendResult = await server.sendTransaction(txObj);
  } catch (cause) {
    throw new RpcError("Failed to submit transaction", cause);
  }

  if (sendResult.status === "ERROR") {
    const detail = sendResult.errorResult?.toXDR("base64") ?? "unknown";
    throw new ContractError(`Transaction submission error: ${detail}`, sendResult.status);
  }

  const hash = sendResult.hash;
  onSubmitted?.(hash);

  return pollTransactionStatus(hash, config);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
