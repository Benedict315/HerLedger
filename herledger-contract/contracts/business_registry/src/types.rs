use soroban_sdk::{contracttype, Address, BytesN};

/// A registered woman-owned business in the HerLedger protocol.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Business {
    /// Unique identifier for this business (32-byte hash).
    pub id: BytesN<32>,
    /// The address that owns and administers this business record.
    pub owner: Address,
    /// The Stellar wallet address associated with this business.
    pub wallet: Address,
    /// Off-chain metadata integrity hash (e.g. IPFS CID or SHA-256 commitment).
    pub metadata_hash: BytesN<32>,
    /// Whether this business is currently active.
    pub active: bool,
}
