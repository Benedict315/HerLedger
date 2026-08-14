// ---------------------------------------------------------------------------
// Application-level types mirroring on-chain contract structures
// ---------------------------------------------------------------------------

export interface Business {
  id: string; // hex-encoded BytesN<32>
  owner: string; // Stellar address
  wallet: string; // Stellar address
  metadataHash: string; // hex-encoded BytesN<32>
  active: boolean;
}

export type EventType =
  | "PaymentReceived"
  | "PaymentSent"
  | "InvoiceSettled"
  | "CommitmentFulfilled";

export type EventStatus = "Pending" | "Verified" | "Disputed" | "Revoked";

export interface FinancialEvent {
  id: string; // hex-encoded BytesN<32>
  businessId: string; // hex-encoded BytesN<32>
  eventType: EventType;
  asset: string; // Stellar asset contract address
  amount: bigint; // i128 — always bigint, never Number
  stellarReference: string; // hex-encoded BytesN<32>
  metadataHash: string; // hex-encoded BytesN<32>
  status: EventStatus;
  createdAt: bigint; // u64 ledger sequence
}

export type AttestationStatus = "Active" | "Revoked";

export interface Attester {
  address: string;
  active: boolean;
  metadataHash: string; // hex-encoded BytesN<32>
}

export interface Attestation {
  id: string; // hex-encoded BytesN<32>
  eventId: string; // hex-encoded BytesN<32>
  attester: string; // Stellar address
  claimHash: string; // hex-encoded BytesN<32>
  issuedAt: bigint; // u64
  status: AttestationStatus;
}

export interface StellarNetworkConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
}

export interface ContractConfig {
  businessRegistryId: string;
  financialLedgerId: string;
  attestationRegistryId: string;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  ledger?: number;
}
