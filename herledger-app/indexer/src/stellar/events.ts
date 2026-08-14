import { rpc as StellarRpc, xdr } from "@stellar/stellar-sdk";
import { decodeBytes32, decodeAddress } from "@herledger/sdk";

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
    const topic =
      event.topic.length > 0
        ? (event.topic[0]?.sym() ?? "unknown")
        : "unknown";

    return {
      ledgerSequence: event.ledger,
      contractId: event.contractId,
      topic,
      value: event.value,
      txHash: event.txHash,
    };
  });
}
