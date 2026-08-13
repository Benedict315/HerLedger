#![cfg(test)]

extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{
    error::Error,
    types::{EventStatus, EventType},
    FinancialLedger, FinancialLedgerClient,
};

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn nonzero_ref(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0xAB; 32])
}

fn deploy(env: &Env) -> (FinancialLedgerClient, Address, Address, Address, Address) {
    let cid = env.register(FinancialLedger, ());
    let client = FinancialLedgerClient::new(env, &cid);
    let admin: Address = Address::generate(env);
    let recorder: Address = Address::generate(env);
    let resolver: Address = Address::generate(env);
    let asset: Address = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &recorder, &resolver);
    client.add_supported_asset(&asset);
    (client, admin, recorder, resolver, asset)
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_once() {
    let env = Env::default();
    let (client, admin, recorder, resolver, _) = deploy(&env);
    let result = client.try_initialize(&admin, &recorder, &resolver);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

// ---------------------------------------------------------------------------
// supported asset — register
// ---------------------------------------------------------------------------

#[test]
fn test_add_supported_asset() {
    let env = Env::default();
    let (client, _, _, _, _) = deploy(&env);
    let asset2: Address = Address::generate(&env);
    assert!(!client.is_supported_asset(&asset2));
    client.add_supported_asset(&asset2);
    assert!(client.is_supported_asset(&asset2));
}

#[test]
fn test_add_supported_asset_duplicate() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    let result = client.try_add_supported_asset(&asset);
    assert_eq!(result, Err(Ok(Error::AlreadyExists)));
}

// ---------------------------------------------------------------------------
// supported asset — remove
// ---------------------------------------------------------------------------

#[test]
fn test_remove_supported_asset() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    client.remove_supported_asset(&asset);
    assert!(!client.is_supported_asset(&asset));
}

#[test]
fn test_remove_not_found() {
    let env = Env::default();
    let (client, _, _, _, _) = deploy(&env);
    let unknown: Address = Address::generate(&env);
    let result = client.try_remove_supported_asset(&unknown);
    assert_eq!(result, Err(Ok(Error::NotFound)));
}

// ---------------------------------------------------------------------------
// record_event — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_record_event_success_payment_received() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x10);
    let business_id = make_id(&env, 0x01);

    client.record_event(
        &event_id,
        &business_id,
        &EventType::PaymentReceived,
        &asset,
        &1000i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.id, event_id);
    assert_eq!(ev.status, EventStatus::Pending);
    assert_eq!(ev.event_type, EventType::PaymentReceived);
    assert_eq!(ev.amount, 1000i128);
}

// ---------------------------------------------------------------------------
// record_event — event begins Pending
// ---------------------------------------------------------------------------

#[test]
fn test_event_begins_pending() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x20);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentSent,
        &asset,
        &500i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Pending);
}

// ---------------------------------------------------------------------------
// record_event — zero amount rejected
// ---------------------------------------------------------------------------

#[test]
fn test_zero_amount_rejected() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let result = client.try_record_event(
        &make_id(&env, 0x30),
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &0i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

// ---------------------------------------------------------------------------
// record_event — negative amount rejected
// ---------------------------------------------------------------------------

#[test]
fn test_negative_amount_rejected() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let result = client.try_record_event(
        &make_id(&env, 0x31),
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &-1i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

// ---------------------------------------------------------------------------
// record_event — positive amount accepted (no minimum)
// ---------------------------------------------------------------------------

#[test]
fn test_positive_amount_accepted() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    // amount of 1 is valid — no minimum
    client.record_event(
        &make_id(&env, 0x32),
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &1i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
}

// ---------------------------------------------------------------------------
// record_event — unsupported asset rejected for payment types
// ---------------------------------------------------------------------------

#[test]
fn test_unsupported_asset_rejected() {
    let env = Env::default();
    let (client, _, _, _, _) = deploy(&env);
    let bad_asset: Address = Address::generate(&env);

    let result = client.try_record_event(
        &make_id(&env, 0x40),
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &bad_asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result, Err(Ok(Error::UnsupportedAsset)));
}

// ---------------------------------------------------------------------------
// record_event — duplicate event rejected
// ---------------------------------------------------------------------------

#[test]
fn test_duplicate_event_rejected() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x50);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    let result = client.try_record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result, Err(Ok(Error::DuplicateEvent)));
}

// ---------------------------------------------------------------------------
// verify_event — Pending -> Verified
// ---------------------------------------------------------------------------

#[test]
fn test_verify_event() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x60);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Verified);
}

// ---------------------------------------------------------------------------
// verify_event — invalid state transition rejected
// ---------------------------------------------------------------------------

#[test]
fn test_verify_already_verified_rejected() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x61);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);
    let result = client.try_verify_event(&event_id);
    assert_eq!(result, Err(Ok(Error::InvalidState)));
}

// ---------------------------------------------------------------------------
// dispute_event — business owner can dispute Verified event
// ---------------------------------------------------------------------------

#[test]
fn test_dispute_event_by_owner() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    let owner: Address = Address::generate(&env);

    let event_id = make_id(&env, 0x70);
    let business_id = make_id(&env, 0x01);
    client.record_event(
        &event_id,
        &business_id,
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);
    client.dispute_event(&event_id, &owner, &make_id(&env, 0xDD));

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Disputed);
    // original fields preserved
    assert_eq!(ev.amount, 100i128);
    assert_eq!(ev.business_id, business_id);
}

// ---------------------------------------------------------------------------
// dispute_event — cannot dispute non-Verified event
// ---------------------------------------------------------------------------

#[test]
fn test_dispute_pending_rejected() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    let owner: Address = Address::generate(&env);

    let event_id = make_id(&env, 0x71);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    let result = client.try_dispute_event(&event_id, &owner, &make_id(&env, 0xDD));
    assert_eq!(result, Err(Ok(Error::DisputeNotAllowed)));
}

// ---------------------------------------------------------------------------
// dispute_event — requires owner auth
// ---------------------------------------------------------------------------

#[test]
fn test_dispute_requires_auth() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x72);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);

    let owner: Address = Address::generate(&env);
    // Clear mocked auths — owner has not signed
    env.set_auths(&[]);
    let result = client.try_dispute_event(&event_id, &owner, &make_id(&env, 0xDD));
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// resolve_dispute — Disputed -> Verified
// ---------------------------------------------------------------------------

#[test]
fn test_resolve_dispute_valid() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    let owner: Address = Address::generate(&env);

    let event_id = make_id(&env, 0x80);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);
    client.dispute_event(&event_id, &owner, &make_id(&env, 0xDD));
    client.resolve_dispute(&event_id, &true, &make_id(&env, 0xEE));

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Verified);
}

// ---------------------------------------------------------------------------
// resolve_dispute — Disputed -> Revoked
// ---------------------------------------------------------------------------

#[test]
fn test_resolve_dispute_invalid() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);
    let owner: Address = Address::generate(&env);

    let event_id = make_id(&env, 0x81);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.verify_event(&event_id);
    client.dispute_event(&event_id, &owner, &make_id(&env, 0xDD));
    client.resolve_dispute(&event_id, &false, &make_id(&env, 0xEE));

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Revoked);
    assert_eq!(ev.amount, 100i128);
}

// ---------------------------------------------------------------------------
// revoke_event — preserves record
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_event_preserves_record() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x90);
    let business_id = make_id(&env, 0x01);
    client.record_event(
        &event_id,
        &business_id,
        &EventType::PaymentReceived,
        &asset,
        &200i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.revoke_event(&event_id, &make_id(&env, 0xFF));

    let ev = client.get_event(&event_id).unwrap();
    assert_eq!(ev.status, EventStatus::Revoked);
    assert_eq!(ev.amount, 200i128);
    assert_eq!(ev.business_id, business_id);
}

// ---------------------------------------------------------------------------
// revoke_event — already revoked rejected
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_already_revoked() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0x91);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    client.revoke_event(&event_id, &make_id(&env, 0xFF));
    let result = client.try_revoke_event(&event_id, &make_id(&env, 0xFF));
    assert_eq!(result, Err(Ok(Error::InvalidState)));
}

// ---------------------------------------------------------------------------
// historical events remain after asset removal
// ---------------------------------------------------------------------------

#[test]
fn test_historical_events_remain_after_asset_removal() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let event_id = make_id(&env, 0xA0);
    client.record_event(
        &event_id,
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &asset,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );

    client.remove_supported_asset(&asset);
    assert!(!client.is_supported_asset(&asset));

    // Historical event must still be accessible
    let ev = client.get_event(&event_id);
    assert!(ev.is_some());
    assert_eq!(ev.unwrap().status, EventStatus::Pending);
}

// ---------------------------------------------------------------------------
// unsupported asset cannot create a verified payment event
// ---------------------------------------------------------------------------

#[test]
fn test_unsupported_asset_cannot_create_payment_event() {
    let env = Env::default();
    let (client, _, _, _, _) = deploy(&env);
    let unsupported: Address = Address::generate(&env);

    let result_recv = client.try_record_event(
        &make_id(&env, 0xB0),
        &make_id(&env, 0x01),
        &EventType::PaymentReceived,
        &unsupported,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result_recv, Err(Ok(Error::UnsupportedAsset)));

    let result_sent = client.try_record_event(
        &make_id(&env, 0xB1),
        &make_id(&env, 0x01),
        &EventType::PaymentSent,
        &unsupported,
        &100i128,
        &nonzero_ref(&env),
        &make_id(&env, 0xAA),
    );
    assert_eq!(result_sent, Err(Ok(Error::UnsupportedAsset)));
}

// ---------------------------------------------------------------------------
// get_business_events pagination
// ---------------------------------------------------------------------------

#[test]
fn test_get_business_events_pagination() {
    let env = Env::default();
    let (client, _, _, _, asset) = deploy(&env);

    let business_id = make_id(&env, 0x01);
    for i in 0u8..5 {
        client.record_event(
            &make_id(&env, i + 0xC0),
            &business_id,
            &EventType::PaymentReceived,
            &asset,
            &(100i128 * (i as i128 + 1)),
            &nonzero_ref(&env),
            &make_id(&env, 0xAA),
        );
    }

    let page1 = client.get_business_events(&business_id, &0, &3);
    assert_eq!(page1.len(), 3);

    let page2 = client.get_business_events(&business_id, &3, &3);
    assert_eq!(page2.len(), 2);

    let empty = client.get_business_events(&business_id, &10, &3);
    assert_eq!(empty.len(), 0);
}
