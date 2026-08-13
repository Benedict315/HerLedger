use soroban_sdk::{contracttype, Address, BytesN, Env, Vec};

use crate::types::FinancialEvent;

/// Minimum TTL in ledgers before a persistent event record is eligible for
/// extension (~1 year at 5 s/ledger).
pub const EVENT_TTL_THRESHOLD: u32 = 6_307_200;
/// TTL to extend persistent event records to upon access or write (~1 year).
pub const EVENT_TTL_EXTEND_TO: u32 = 6_307_200;

/// Minimum TTL for supported-asset records (~1 year).
pub const ASSET_TTL_THRESHOLD: u32 = 6_307_200;
/// Extension target for supported-asset records (~1 year).
pub const ASSET_TTL_EXTEND_TO: u32 = 6_307_200;

/// Maximum number of events returned in a single paginated read.
pub const MAX_PAGE_LIMIT: u32 = 100;

/// Storage keys used by the FinancialLedger contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Protocol administrator address (instance storage).
    Admin,
    /// Authorised recorder/verifier address (instance storage).
    Recorder,
    /// Authorised dispute resolver address (instance storage).
    Resolver,
    /// A `FinancialEvent` record keyed by event id.
    Event(BytesN<32>),
    /// Whether an asset `Address` is currently supported (bool).
    SupportedAsset(Address),
    /// Ordered list of event ids for a given business id.
    BusinessEvents(BytesN<32>),
}

// ---------------------------------------------------------------------------
// Admin / authority helpers
// ---------------------------------------------------------------------------

pub fn save_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn save_recorder(env: &Env, recorder: &Address) {
    env.storage().instance().set(&DataKey::Recorder, recorder);
}

pub fn load_recorder(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Recorder)
}

pub fn save_resolver(env: &Env, resolver: &Address) {
    env.storage().instance().set(&DataKey::Resolver, resolver);
}

pub fn load_resolver(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Resolver)
}

// ---------------------------------------------------------------------------
// Supported asset helpers
// ---------------------------------------------------------------------------

/// Mark an asset as supported (true) or disabled (false).
pub fn save_asset_status(env: &Env, asset: &Address, enabled: bool) {
    let key = DataKey::SupportedAsset(asset.clone());
    env.storage().persistent().set(&key, &enabled);
    env.storage()
        .persistent()
        .extend_ttl(&key, ASSET_TTL_THRESHOLD, ASSET_TTL_EXTEND_TO);
}

/// Returns `true` if the asset is currently marked as supported.
pub fn load_asset_status(env: &Env, asset: &Address) -> bool {
    let key = DataKey::SupportedAsset(asset.clone());
    let result: Option<bool> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, ASSET_TTL_THRESHOLD, ASSET_TTL_EXTEND_TO);
    }
    result.unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Financial event helpers
// ---------------------------------------------------------------------------

/// Persist a financial event record and refresh its TTL.
pub fn save_event(env: &Env, event: &FinancialEvent) {
    let key = DataKey::Event(event.id.clone());
    env.storage().persistent().set(&key, event);
    env.storage()
        .persistent()
        .extend_ttl(&key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);
}

/// Load a financial event record by id.
pub fn load_event(env: &Env, event_id: &BytesN<32>) -> Option<FinancialEvent> {
    let key = DataKey::Event(event_id.clone());
    let result: Option<FinancialEvent> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);
    }
    result
}

// ---------------------------------------------------------------------------
// Business event index helpers
// ---------------------------------------------------------------------------

/// Append an event id to the ordered list for a business.
pub fn append_business_event(env: &Env, business_id: &BytesN<32>, event_id: &BytesN<32>) {
    let key = DataKey::BusinessEvents(business_id.clone());
    let mut ids: Vec<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    ids.push_back(event_id.clone());
    env.storage().persistent().set(&key, &ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);
}

/// Load a paginated slice of financial events for a business.
///
/// Events are ordered by insertion (chronological). `offset` is zero-based.
/// `limit` is capped at [`MAX_PAGE_LIMIT`].
pub fn load_business_events(
    env: &Env,
    business_id: &BytesN<32>,
    offset: u32,
    limit: u32,
) -> Vec<FinancialEvent> {
    let effective_limit = limit.min(MAX_PAGE_LIMIT);
    let key = DataKey::BusinessEvents(business_id.clone());
    let ids: Vec<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    if ids.is_empty() {
        return Vec::new(env);
    }

    env.storage()
        .persistent()
        .extend_ttl(&key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);

    let total = ids.len();
    let start = offset.min(total);
    let end = (start + effective_limit).min(total);

    let mut result: Vec<FinancialEvent> = Vec::new(env);
    for i in start..end {
        let eid = ids.get(i).unwrap();
        if let Some(ev) = load_event(env, &eid) {
            result.push_back(ev);
        }
    }
    result
}
