import { getPrismaClient } from "../db/client.js";
import { getCheckpoint, saveCheckpoint, MAIN_STREAM } from "../db/schema/checkpoint.js";
import { findAllActiveBusinessWallets } from "../db/schema/businesses.js";
import { writeDeadLetter } from "../db/schema/indexer-errors.js";
import { processTransactionForWallet } from "./process-transaction.js";
import { fetchTransactionsForAccount, fetchLatestLedger } from "../stellar/rpc.js";
import { isSuccessfulTransaction, getTransactionLedger } from "../stellar/verification.js";
import {
  getStellarNetworkConfig,
  getContractConfig as getRawContractConfig,
  validateNetworkConsistency,
} from "@herledger/config/server";
import {
  registerCurrentNetworkAddresses,
  buildContractConfig,
  type ContractConfig,
} from "@herledger/sdk";
import {
  resetCycleMetrics,
  recordIndexed,
  recordFailed,
  recordSkipped,
  recordDeadLettered,
  finishCycleMetrics,
} from "./sync-metrics.js";

// ---------------------------------------------------------------------------
// Main ledger sync job
// Restartable, idempotent, checkpoint-driven.
// ---------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 30_000; // 30 seconds between sync cycles
const WALLET_PAGE_SIZE = 100;

export async function runSyncJob(): Promise<void> {
  const prisma = getPrismaClient();
  const stellarConfig = getStellarNetworkConfig();
  const rawContractConfig = getRawContractConfig();
  const registry = registerCurrentNetworkAddresses(stellarConfig.network, rawContractConfig);
  const contractConfig = buildContractConfig(registry, stellarConfig.network, rawContractConfig);

  validateNetworkConsistency(
    stellarConfig.network,
    stellarConfig.rpcUrl,
    stellarConfig.networkPassphrase
  );

  console.log({ job: "sync-ledger", event: "start", network: stellarConfig.network });

  while (true) {
    try {
      await syncCycle(prisma, stellarConfig, contractConfig);
    } catch (err) {
      console.error({
        job: "sync-ledger",
        event: "cycle-error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(SYNC_INTERVAL_MS);
  }
}

async function syncCycle(
  prisma: ReturnType<typeof getPrismaClient>,
  stellarConfig: ReturnType<typeof getStellarNetworkConfig>,
  contractConfig: ContractConfig
): Promise<void> {
  resetCycleMetrics();

  const latestLedger = await fetchLatestLedger(stellarConfig);
  const lastCheckpoint = await getCheckpoint(prisma, MAIN_STREAM);

  console.log({
    job: "sync-ledger",
    event: "cycle-begin",
    lastCheckpoint,
    latestLedger,
  });

  let maxProcessedLedger = lastCheckpoint;
  let anyWallets = false;

  // Iterate active business wallets in cursor pages -- never load the full
  // set into memory at once. Each page is fetched only after the previous
  // one has been fully processed.
  let walletCursor: string | undefined;
  while (true) {
    const { wallets, nextCursor } = await findAllActiveBusinessWallets(prisma, {
      ...(walletCursor !== undefined && { cursor: walletCursor }),
      pageSize: WALLET_PAGE_SIZE,
    });

    if (wallets.length > 0) {
      anyWallets = true;
    }

    for (const { walletAddress } of wallets) {
      let txCursor: string | undefined;

      // Paginate through all transactions for this wallet
      while (true) {
        const { transactions, nextCursor: nextTxCursor } = await fetchTransactionsForAccount(
          walletAddress,
          stellarConfig.horizonUrl,
          txCursor
        );

        for (const tx of transactions) {
          const ledger = getTransactionLedger(tx);

          // Only process ledgers after our last checkpoint
          if (ledger <= lastCheckpoint) continue;

          if (!isSuccessfulTransaction(tx)) continue;

          try {
            const outcome = await processTransactionForWallet(
              tx,
              walletAddress,
              prisma,
              stellarConfig,
              contractConfig
            );
            if (outcome === "indexed") {
              recordIndexed();
            } else {
              recordSkipped();
            }
          } catch (err) {
            recordFailed();
            recordDeadLettered();
            try {
              await writeDeadLetter(prisma, {
                rawXdr: tx.envelope_xdr,
                stage: "index",
                message: err instanceof Error ? err.message : String(err),
                context: { walletAddress, ledgerSequence: ledger },
              });
            } catch (dlErr) {
              // If we can't even write the dead-letter row, at minimum log it
              // loudly -- this event's failure would otherwise be silently lost.
              console.error({
                job: "sync-ledger",
                event: "dead-letter-write-failed",
                transactionHash: tx.hash,
                originalError: err instanceof Error ? err.message : String(err),
                writeError: dlErr instanceof Error ? dlErr.message : String(dlErr),
              });
            }
            console.error({
              job: "sync-ledger",
              event: "transaction-failed",
              transactionHash: tx.hash,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if (ledger > maxProcessedLedger) {
            maxProcessedLedger = ledger;
          }
        }

        if (!nextTxCursor || transactions.length === 0) break;
        txCursor = nextTxCursor;
      }
    }

    if (!nextCursor) break;
    walletCursor = nextCursor;
  }

  finishCycleMetrics();

  if (!anyWallets) {
    await saveCheckpoint(prisma, MAIN_STREAM, latestLedger);
    return;
  }

  // Persist checkpoint only after successful processing
  if (maxProcessedLedger > lastCheckpoint) {
    await saveCheckpoint(prisma, MAIN_STREAM, maxProcessedLedger);
    console.log({
      job: "sync-ledger",
      event: "checkpoint-saved",
      ledger: maxProcessedLedger,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
