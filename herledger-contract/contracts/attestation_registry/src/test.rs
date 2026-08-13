#![cfg(test)]

extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{
    error::Error, types::AttestationStatus, AttestationRegistry, AttestationRegistryClient,
};

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn deploy(env: &Env) -> AttestationRegistryClient {
    let cid = env.register(AttestationRegistry, ());
    let client = AttestationRegistryClient::new(env, &cid);
    let admin: Address = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    client
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_once() {
    let env = Env::default();
    let client = deploy(&env);
    let admin2: Address = Address::generate(&env);
    let result = client.try_initialize(&admin2);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

// ---------------------------------------------------------------------------
// register_attester — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_register_attester_success() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
}

// ---------------------------------------------------------------------------
// register_attester — duplicate active attester rejected
// ---------------------------------------------------------------------------

#[test]
fn test_register_attester_duplicate() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
    let result = client.try_register_attester(&attester, &make_id(&env, 0xAA));
    assert_eq!(result, Err(Ok(Error::AlreadyExists)));
}

// ---------------------------------------------------------------------------
// deactivate_attester — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_attester_success() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
    client.deactivate_attester(&attester);
}

// ---------------------------------------------------------------------------
// deactivate_attester — not found
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_attester_not_found() {
    let env = Env::default();
    let client = deploy(&env);
    let unknown: Address = Address::generate(&env);
    let result = client.try_deactivate_attester(&unknown);
    assert_eq!(result, Err(Ok(Error::NotFound)));
}

// ---------------------------------------------------------------------------
// deactivate_attester — already inactive
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_attester_already_inactive() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
    client.deactivate_attester(&attester);
    let result = client.try_deactivate_attester(&attester);
    assert_eq!(result, Err(Ok(Error::Inactive)));
}

// ---------------------------------------------------------------------------
// inactive attester cannot create attestation
// ---------------------------------------------------------------------------

#[test]
fn test_inactive_attester_cannot_attest() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
    client.deactivate_attester(&attester);

    let result = client.try_create_attestation(
        &make_id(&env, 0x10),
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );
    assert_eq!(result, Err(Ok(Error::InactiveAttester)));
}

// ---------------------------------------------------------------------------
// create_attestation — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_create_attestation_success() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    let att_id = make_id(&env, 0x10);
    let event_id = make_id(&env, 0x01);
    let claim = make_id(&env, 0xBB);
    client.create_attestation(&att_id, &event_id, &attester, &claim);

    let att = client.get_attestation(&att_id).unwrap();
    assert_eq!(att.id, att_id);
    assert_eq!(att.event_id, event_id);
    assert_eq!(att.attester, attester);
    assert_eq!(att.claim_hash, claim);
    assert_eq!(att.status, AttestationStatus::Active);
}

// ---------------------------------------------------------------------------
// create_attestation — unregistered attester
// ---------------------------------------------------------------------------

#[test]
fn test_create_attestation_unregistered_attester() {
    let env = Env::default();
    let client = deploy(&env);
    let unknown: Address = Address::generate(&env);
    let result = client.try_create_attestation(
        &make_id(&env, 0x10),
        &make_id(&env, 0x01),
        &unknown,
        &make_id(&env, 0xBB),
    );
    assert_eq!(result, Err(Ok(Error::InvalidAttester)));
}

// ---------------------------------------------------------------------------
// create_attestation — duplicate id rejected
// ---------------------------------------------------------------------------

#[test]
fn test_create_attestation_duplicate() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    let att_id = make_id(&env, 0x10);
    client.create_attestation(
        &att_id,
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );
    let result = client.try_create_attestation(
        &att_id,
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );
    assert_eq!(result, Err(Ok(Error::DuplicateAttestation)));
}

// ---------------------------------------------------------------------------
// create_attestation — requires attester auth
// ---------------------------------------------------------------------------

#[test]
fn test_create_attestation_requires_auth() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    // Clear all mocked auths — attester has not signed
    env.set_auths(&[]);
    let result = client.try_create_attestation(
        &make_id(&env, 0x10),
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// revoke_attestation — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_attestation_success() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    let att_id = make_id(&env, 0x10);
    client.create_attestation(
        &att_id,
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );

    assert!(client.is_valid_attestation(&att_id));
    client.revoke_attestation(&att_id, &make_id(&env, 0xFF));
    assert!(!client.is_valid_attestation(&att_id));

    let att = client.get_attestation(&att_id).unwrap();
    assert_eq!(att.status, AttestationStatus::Revoked);
    assert_eq!(att.claim_hash, make_id(&env, 0xBB));
}

// ---------------------------------------------------------------------------
// revoke_attestation — already revoked rejected
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_attestation_already_revoked() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    let att_id = make_id(&env, 0x10);
    client.create_attestation(
        &att_id,
        &make_id(&env, 0x01),
        &attester,
        &make_id(&env, 0xBB),
    );
    client.revoke_attestation(&att_id, &make_id(&env, 0xFF));
    let result = client.try_revoke_attestation(&att_id, &make_id(&env, 0xFF));
    assert_eq!(result, Err(Ok(Error::InvalidState)));
}

// ---------------------------------------------------------------------------
// revoke_attestation — not found
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_attestation_not_found() {
    let env = Env::default();
    let client = deploy(&env);
    let result = client.try_revoke_attestation(&make_id(&env, 0x99), &make_id(&env, 0xFF));
    assert_eq!(result, Err(Ok(Error::NotFound)));
}

// ---------------------------------------------------------------------------
// is_valid_attestation — unknown id returns false
// ---------------------------------------------------------------------------

#[test]
fn test_is_valid_attestation_unknown() {
    let env = Env::default();
    let client = deploy(&env);
    assert!(!client.is_valid_attestation(&make_id(&env, 0x99)));
}

// ---------------------------------------------------------------------------
// historical record preserved after deactivation + revocation
// ---------------------------------------------------------------------------

#[test]
fn test_historical_attestation_preserved() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));

    let att_id = make_id(&env, 0x20);
    let event_id = make_id(&env, 0x01);
    let claim = make_id(&env, 0xCC);
    client.create_attestation(&att_id, &event_id, &attester, &claim);
    client.deactivate_attester(&attester);
    client.revoke_attestation(&att_id, &make_id(&env, 0xFF));

    let att = client.get_attestation(&att_id).unwrap();
    assert_eq!(att.event_id, event_id);
    assert_eq!(att.claim_hash, claim);
    assert_eq!(att.attester, attester);
    assert_eq!(att.status, AttestationStatus::Revoked);
}

// ---------------------------------------------------------------------------
// re-register deactivated attester is allowed
// ---------------------------------------------------------------------------

#[test]
fn test_reregister_deactivated_attester() {
    let env = Env::default();
    let client = deploy(&env);
    let attester: Address = Address::generate(&env);
    client.register_attester(&attester, &make_id(&env, 0xAA));
    client.deactivate_attester(&attester);
    // re-registration of a previously deactivated attester is permitted
    client.register_attester(&attester, &make_id(&env, 0xBB));
}
