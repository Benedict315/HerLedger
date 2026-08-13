use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::Business;

/// Minimum TTL in ledgers for persistent business records (~1 year at 5s/ledger).
pub const BUSINESS_TTL_THRESHOLD: u32 = 6_307_200;
/// TTL extension target in ledgers for persistent business records (~1 year).
pub const BUSINESS_TTL_EXTEND_TO: u32 = 6_307_200;

/// Storage keys used by the BusinessRegistry contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Stores a `Business` record keyed by business id.
    Business(BytesN<32>),
    /// Maps a wallet `Address` to a business id (`BytesN<32>`).
    WalletIndex(Address),
    /// Maps an owner `Address` to a business id (`BytesN<32>`).
    OwnerIndex(Address),
    /// The protocol administrator address (instance storage).
    Admin,
}

/// Persist a business record and refresh its TTL.
pub fn save_business(env: &Env, business: &Business) {
    let key = DataKey::Business(business.id.clone());
    env.storage().persistent().set(&key, business);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
}

/// Load a business record by id, returning `None` if absent.
pub fn load_business(env: &Env, business_id: &BytesN<32>) -> Option<Business> {
    let key = DataKey::Business(business_id.clone());
    let result: Option<Business> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
    }
    result
}

/// Persist the wallet → business_id index and refresh its TTL.
pub fn save_wallet_index(env: &Env, wallet: &Address, business_id: &BytesN<32>) {
    let key = DataKey::WalletIndex(wallet.clone());
    env.storage().persistent().set(&key, business_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
}

/// Load the business id associated with a wallet address.
pub fn load_wallet_index(env: &Env, wallet: &Address) -> Option<BytesN<32>> {
    let key = DataKey::WalletIndex(wallet.clone());
    let result: Option<BytesN<32>> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
    }
    result
}

/// Persist the owner → business_id index and refresh its TTL.
pub fn save_owner_index(env: &Env, owner: &Address, business_id: &BytesN<32>) {
    let key = DataKey::OwnerIndex(owner.clone());
    env.storage().persistent().set(&key, business_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
}

/// Load the business id associated with an owner address.
pub fn load_owner_index(env: &Env, owner: &Address) -> Option<BytesN<32>> {
    let key = DataKey::OwnerIndex(owner.clone());
    let result: Option<BytesN<32>> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUSINESS_TTL_THRESHOLD, BUSINESS_TTL_EXTEND_TO);
    }
    result
}

/// Persist the protocol admin address in instance storage.
pub fn save_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

/// Load the protocol admin address from instance storage.
pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}
