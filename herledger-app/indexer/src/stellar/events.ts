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
  return events.map((event) => {
    const firstTopic = event.topic[0];
    const topic = firstTopic ? firstTopic.sym() : "unknown";

    return {
      ledgerSequence: event.ledger,
      contractId: event.contractId,
      topic,
      value: event.value,
      txHash: event.txHash,
    };
  });
}
