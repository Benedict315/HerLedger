use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::{Attestation, Attester};

/// Minimum TTL in ledgers before a persistent attester record is eligible for
/// extension (~1 year at 5 s/ledger).
pub const ATTESTER_TTL_THRESHOLD: u32 = 6_307_200;
/// TTL to extend persistent attester records to upon access or write (~1 year).
pub const ATTESTER_TTL_EXTEND_TO: u32 = 6_307_200;

/// Minimum TTL for attestation records (~1 year).
pub const ATTESTATION_TTL_THRESHOLD: u32 = 6_307_200;
/// Extension target for attestation records (~1 year).
pub const ATTESTATION_TTL_EXTEND_TO: u32 = 6_307_200;

/// Storage keys used by the AttestationRegistry contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Protocol administrator address (instance storage).
    Admin,
    /// An `Attester` record keyed by attester `Address`.
    Attester(Address),
    /// An `Attestation` record keyed by attestation id.
    Attestation(BytesN<32>),
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

pub fn save_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

// ---------------------------------------------------------------------------
// Attester helpers
// ---------------------------------------------------------------------------

/// Persist an attester record and refresh its TTL.
pub fn save_attester(env: &Env, attester: &Attester) {
    let key = DataKey::Attester(attester.address.clone());
    env.storage().persistent().set(&key, attester);
    env.storage()
        .persistent()
        .extend_ttl(&key, ATTESTER_TTL_THRESHOLD, ATTESTER_TTL_EXTEND_TO);
}

/// Load an attester record by address.
pub fn load_attester(env: &Env, address: &Address) -> Option<Attester> {
    let key = DataKey::Attester(address.clone());
    let result: Option<Attester> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, ATTESTER_TTL_THRESHOLD, ATTESTER_TTL_EXTEND_TO);
    }
    result
}

// ---------------------------------------------------------------------------
// Attestation helpers
// ---------------------------------------------------------------------------

/// Persist an attestation record and refresh its TTL.
pub fn save_attestation(env: &Env, attestation: &Attestation) {
    let key = DataKey::Attestation(attestation.id.clone());
    env.storage().persistent().set(&key, attestation);
    env.storage().persistent().extend_ttl(
        &key,
        ATTESTATION_TTL_THRESHOLD,
        ATTESTATION_TTL_EXTEND_TO,
    );
}

/// Load an attestation record by id.
pub fn load_attestation(env: &Env, attestation_id: &BytesN<32>) -> Option<Attestation> {
    let key = DataKey::Attestation(attestation_id.clone());
    let result: Option<Attestation> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            ATTESTATION_TTL_THRESHOLD,
            ATTESTATION_TTL_EXTEND_TO,
        );
    }
    result
}
