import { Contract, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, it, expect } from "vitest";

import { parseContractEvents } from "../events.js";

const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));

function baseFields(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "0000000001-0000000000",
    type: "contract",
    ledger: 100,
    ledgerClosedAt: new Date().toISOString(),
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "a".repeat(64),
    topic: [xdr.ScVal.scvSymbol("EventName")],
    value: xdr.ScVal.scvVoid(),
    ...overrides,
  };
}

describe("parseContractEvents", () => {
  it("maps contractId to its strkey address and topic to a string", () => {
    const events = [baseFields({ contractId: new Contract(CONTRACT_ID) })] as unknown as Parameters<
      typeof parseContractEvents
    >[0];

    const [parsed] = parseContractEvents(events);

    expect(parsed).toBeDefined();
    expect(parsed!.contractId).toBe(CONTRACT_ID);
    expect(parsed!.topic).toBe("EventName");
    expect(parsed!.ledgerSequence).toBe(100);
    expect(parsed!.txHash).toBe("a".repeat(64));
  });

  it("skips events with no contractId rather than fabricating one", () => {
    const events = [
      baseFields({ contractId: new Contract(CONTRACT_ID) }),
      baseFields({ contractId: undefined }),
    ] as unknown as Parameters<typeof parseContractEvents>[0];

    const parsed = parseContractEvents(events);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.contractId).toBe(CONTRACT_ID);
  });

  it('falls back to "unknown" when an event has no first topic', () => {
    const events = [
      baseFields({ contractId: new Contract(CONTRACT_ID), topic: [] }),
    ] as unknown as Parameters<typeof parseContractEvents>[0];

    const [parsed] = parseContractEvents(events);

    expect(parsed!.topic).toBe("unknown");
  });
});
