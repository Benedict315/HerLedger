import {
  rpc as StellarRpc,
  Transaction,
  xdr,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";
import type { StellarNetworkConfig, TransactionResult } from "../types/index.js";
import { RpcError, ContractError } from "../errors/index.js";
import { getSorobanRpcServer } from "./client.js";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

/**
 * Simulate a transaction and return the prepared transaction with
 * the resource footprint and fee populated from the simulation result.
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
    throw new RpcError("Transaction simulation failed", cause);
  }

  if (StellarRpc.Api.isSimulationError(simResult)) {
    throw new ContractError(
      `Simulation error: ${simResult.error}`,
      simResult.error
    );
  }

  const prepared = StellarRpc.assembleTransaction(tx, simResult).build();
  return prepared as unknown as Transaction;
}

/**
 * Submit a signed transaction and poll until it is confirmed or fails.
 */
export async function submitAndWait(
  signedXdr: string,
  config: StellarNetworkConfig
): Promise<TransactionResult> {
  const server = getSorobanRpcServer(config);

  let sendResult: StellarRpc.Api.SendTransactionResponse;
  try {
    sendResult = await server.sendTransaction(
      TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase)
    );
  } catch (cause) {
    throw new RpcError("Failed to submit transaction", cause);
  }

  if (sendResult.status === "ERROR") {
    throw new ContractError(
      `Transaction submission error: ${sendResult.errorResult?.toXDR("base64") ?? "unknown"}`,
      sendResult.status
    );
  }

  const hash = sendResult.hash;

  // Poll for confirmation
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    let getResult: StellarRpc.Api.GetTransactionResponse;
    try {
      getResult = await server.getTransaction(hash);
    } catch (cause) {
      throw new RpcError(`Failed to poll transaction ${hash}`, cause);
    }

    if (getResult.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash, success: true, ledger: getResult.ledger };
    }
    if (getResult.status === StellarRpc.Api.GetTransactionStatus.FAILED) {
      throw new ContractError(
        `Transaction ${hash} failed on-chain`,
        getResult.status
      );
    }
    // NOT_FOUND means still pending — keep polling
  }

  throw new RpcError(`Transaction ${hash} did not confirm within timeout`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
