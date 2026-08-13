use soroban_sdk::{contracttype, Address, BytesN};

/// Lifecycle status of an attestation.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AttestationStatus {
    /// The attestation is currently active and valid.
    Active,
    /// The attestation has been revoked; the record is preserved.
    Revoked,
}

/// A registered attester in the HerLedger protocol.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attester {
    /// The attester's Stellar address.
    pub address: Address,
    /// Whether this attester is currently active.
    pub active: bool,
    /// Off-chain metadata integrity hash for this attester.
    pub metadata_hash: BytesN<32>,
}

/// A contextual claim attached to a HerLedger financial event.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    /// Unique identifier for this attestation (32-byte hash).
    pub id: BytesN<32>,
    /// The financial event this attestation refers to.
    pub event_id: BytesN<32>,
    /// The attester that issued this attestation.
    pub attester: Address,
    /// Hash of the off-chain claim document.
    pub claim_hash: BytesN<32>,
    /// Ledger sequence number at issuance.
    pub issued_at: u64,
    /// Current lifecycle status.
    pub status: AttestationStatus,
}
