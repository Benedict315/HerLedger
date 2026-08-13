#![cfg(test)]

extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{error::Error, BusinessRegistry, BusinessRegistryClient};

fn make_env() -> Env {
    Env::default()
}

fn deploy(env: &Env) -> BusinessRegistryClient {
    let contract_id = env.register(BusinessRegistry, ());
    let client = BusinessRegistryClient::new(env, &contract_id);
    let admin: Address = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    client
}

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

// ---------------------------------------------------------------------------
// initialization
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_once() {
    let env = make_env();
    let client = deploy(&env);
    let admin2: Address = Address::generate(&env);
    let result = client.try_initialize(&admin2);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

// ---------------------------------------------------------------------------
// register_business — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_register_business_success() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);

    let business = client.get_business(&id).unwrap();
    assert_eq!(business.id, id);
    assert_eq!(business.owner, owner);
    assert_eq!(business.wallet, wallet);
    assert_eq!(business.metadata_hash, meta);
    assert!(business.active);
}

// ---------------------------------------------------------------------------
// register_business — duplicate id rejected
// ---------------------------------------------------------------------------

#[test]
fn test_register_business_duplicate_id() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);

    let owner2: Address = Address::generate(&env);
    let wallet2: Address = Address::generate(&env);
    let result = client.try_register_business(&id, &owner2, &wallet2, &meta);
    assert_eq!(result, Err(Ok(Error::AlreadyExists)));
}

// ---------------------------------------------------------------------------
// register_business — wallet uniqueness enforced
// ---------------------------------------------------------------------------

#[test]
fn test_register_business_wallet_conflict() {
    let env = make_env();
    let client = deploy(&env);

    let owner1: Address = Address::generate(&env);
    let owner2: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id1 = make_id(&env, 1);
    let id2 = make_id(&env, 2);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id1, &owner1, &wallet, &meta);
    let result = client.try_register_business(&id2, &owner2, &wallet, &meta);
    assert_eq!(result, Err(Ok(Error::InvalidWallet)));
}

// ---------------------------------------------------------------------------
// register_business — one active business per owner
// ---------------------------------------------------------------------------

#[test]
fn test_register_business_owner_already_active() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet1: Address = Address::generate(&env);
    let wallet2: Address = Address::generate(&env);
    let id1 = make_id(&env, 1);
    let id2 = make_id(&env, 2);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id1, &owner, &wallet1, &meta);
    let result = client.try_register_business(&id2, &owner, &wallet2, &meta);
    assert_eq!(result, Err(Ok(Error::AlreadyRegistered)));
}

// ---------------------------------------------------------------------------
// get_business_by_wallet
// ---------------------------------------------------------------------------

#[test]
fn test_get_business_by_wallet() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 5);
    let meta = make_id(&env, 0xBB);

    client.register_business(&id, &owner, &wallet, &meta);

    let found = client.get_business_by_wallet(&wallet).unwrap();
    assert_eq!(found.id, id);

    let missing: Address = Address::generate(&env);
    assert!(client.get_business_by_wallet(&missing).is_none());
}

// ---------------------------------------------------------------------------
// update_metadata — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_update_metadata_success() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta1 = make_id(&env, 0xAA);
    let meta2 = make_id(&env, 0xBB);

    client.register_business(&id, &owner, &wallet, &meta1);
    client.update_metadata(&id, &meta2);

    let business = client.get_business(&id).unwrap();
    assert_eq!(business.metadata_hash, meta2);
}

// ---------------------------------------------------------------------------
// update_metadata — not found
// ---------------------------------------------------------------------------

#[test]
fn test_update_metadata_not_found() {
    let env = make_env();
    let client = deploy(&env);

    let result = client.try_update_metadata(&make_id(&env, 99), &make_id(&env, 1));
    assert_eq!(result, Err(Ok(Error::NotFound)));
}

// ---------------------------------------------------------------------------
// update_metadata — inactive business rejected
// ---------------------------------------------------------------------------

#[test]
fn test_update_metadata_inactive() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);
    client.deactivate_business(&id);

    let result = client.try_update_metadata(&id, &make_id(&env, 0xBB));
    assert_eq!(result, Err(Ok(Error::Inactive)));
}

// ---------------------------------------------------------------------------
// deactivate_business — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_business_success() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);
    client.deactivate_business(&id);

    let business = client.get_business(&id).unwrap();
    assert!(!business.active);
}

// ---------------------------------------------------------------------------
// deactivate_business — already inactive
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_already_inactive() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);
    client.deactivate_business(&id);

    let result = client.try_deactivate_business(&id);
    assert_eq!(result, Err(Ok(Error::Inactive)));
}

// ---------------------------------------------------------------------------
// deactivate_business — not found
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_not_found() {
    let env = make_env();
    let client = deploy(&env);

    let result = client.try_deactivate_business(&make_id(&env, 99));
    assert_eq!(result, Err(Ok(Error::NotFound)));
}

// ---------------------------------------------------------------------------
// historical record preserved after deactivation
// ---------------------------------------------------------------------------

#[test]
fn test_historical_record_after_deactivation() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);
    client.deactivate_business(&id);

    let business = client.get_business(&id).unwrap();
    assert_eq!(business.id, id);
    assert_eq!(business.owner, owner);
    assert_eq!(business.metadata_hash, meta);
    assert!(!business.active);
}

// ---------------------------------------------------------------------------
// authorization — register requires owner auth
// ---------------------------------------------------------------------------

#[test]
fn test_register_requires_owner_auth() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    // Clear mocked auths — owner has not signed
    env.set_auths(&[]);
    let result = client.try_register_business(&id, &owner, &wallet, &meta);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// authorization — update_metadata requires owner auth
// ---------------------------------------------------------------------------

#[test]
fn test_update_metadata_requires_owner_auth() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);

    // Clear mocked auths — owner has not signed
    env.set_auths(&[]);
    let result = client.try_update_metadata(&id, &make_id(&env, 0xBB));
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// authorization — deactivate requires owner auth
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_requires_owner_auth() {
    let env = make_env();
    let client = deploy(&env);

    let owner: Address = Address::generate(&env);
    let wallet: Address = Address::generate(&env);
    let id = make_id(&env, 1);
    let meta = make_id(&env, 0xAA);

    client.register_business(&id, &owner, &wallet, &meta);

    // Clear mocked auths — owner has not signed
    env.set_auths(&[]);
    let result = client.try_deactivate_business(&id);
    assert!(result.is_err());
}
