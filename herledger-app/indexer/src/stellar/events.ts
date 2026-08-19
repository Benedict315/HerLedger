import { rpc as StellarRpc, xdr } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Soroban contract event parsing
// ---------------------------------------------------------------------------

export interface ParsedContractEvent {
  ledgerSequence: number;
  contractId: string;
  topic: string;
  value: xdr.ScVal;
  txHash: string;
}

/**
 * Parse raw Soroban events into structured records.
 */
export function parseContractEvents(
  events: StellarRpc.Api.GetEventsResponse["events"]
): ParsedContractEvent[] {
  // `event.contractId` is only absent for the (rare) diagnostic events the
  // RPC surfaces without one; those aren't attributable to a contract and
  // can't be represented as a `ParsedContractEvent`, so they're skipped.
  return events.flatMap((event) => {
    if (event.contractId === undefined) return [];

    const firstTopic = event.topic[0];
    const topic = firstTopic ? String(firstTopic.sym()) : "unknown";

    return [
      {
        ledgerSequence: event.ledger,
        contractId: event.contractId.contractId(),
        topic,
        value: event.value,
        txHash: event.txHash,
      },
    ];
  });
}
