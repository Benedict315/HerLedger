use soroban_sdk::{contracttype, Address, BytesN};

/// The kind of HerLedger financial event being recorded.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EventType {
    /// A successful supported-asset transfer received by the registered business wallet.
    PaymentReceived,
    /// A successful supported-asset transfer sent from the registered business wallet.
    PaymentSent,
    /// A payment that the application layer has determined settled an invoice,
    /// supported by contextual attestation.
    InvoiceSettled,
    /// A payment that the application layer has determined fulfilled a real-world
    /// commitment, supported by contextual attestation.
    CommitmentFulfilled,
}

/// The lifecycle status of a HerLedger financial event.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EventStatus {
    /// Recorded but not yet verified by the authorised verifier.
    Pending,
    /// Verified by the authorised HerLedger verifier.
    Verified,
    /// Disputed by the business owner after verification.
    Disputed,
    /// Revoked by the authorised resolver; the record is preserved.
    Revoked,
}

/// A HerLedger financial event record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinancialEvent {
    /// Unique identifier for this event (32-byte hash).
    pub id: BytesN<32>,
    /// The business this event belongs to.
    pub business_id: BytesN<32>,
    /// The kind of financial event.
    pub event_type: EventType,
    /// The Stellar asset contract address.
    pub asset: Address,
    /// Transfer amount as a positive integer (no floating point).
    pub amount: i128,
    /// The Stellar transaction hash or ledger reference (32 bytes).
    pub stellar_reference: BytesN<32>,
    /// Off-chain metadata integrity hash.
    pub metadata_hash: BytesN<32>,
    /// Current lifecycle status.
    pub status: EventStatus,
    /// Ledger sequence number at creation time.
    pub created_at: u64,
}
